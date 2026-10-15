import axios from 'axios';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ShopeeService } from './shopee.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const PARTNER_ID = '1000001';
const PARTNER_KEY = 'chave-secreta-teste';
const TIMESTAMP = 1700000000;

/**
 * Assinaturas de referência calculadas com o `openssl`, FORA deste código:
 *
 *   echo -n "1000001/api/v2/shop/get_shop_info1700000000TOKEN_ABC555666" \
 *     | openssl dgst -sha256 -hmac "chave-secreta-teste"
 *
 * Se a ordem de concatenação da base mudar, a Shopee recusa todas as
 * chamadas — e este teste quebra antes.
 */
const ASSINATURA_LOJA =
  'be5ead6f5cb29b13ce0235db3614d030d6b7551202bf2f1eebb3db0e67d29d27';
const ASSINATURA_PUBLICA =
  'eb68507d8c64ead3c369784ef28d12aa375aa8039e00ead4817ad76831585e95';
const ASSINATURA_RENOVACAO =
  '47d372206c8073e3c0def2fa4b2335af9daf2fdbf810a8cc182cc0171c024e69';

function criarServico(credenciais = true): ShopeeService {
  const config = {
    get: (chave: string, padrao?: string) => {
      if (!credenciais && chave.startsWith('SHOPEE_PARTNER')) return '';
      if (chave === 'SHOPEE_PARTNER_ID') return PARTNER_ID;
      if (chave === 'SHOPEE_PARTNER_KEY') return PARTNER_KEY;
      return padrao;
    },
  };
  return new ShopeeService(
    config as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function urlChamada(): URL {
  return new URL(mockedAxios.get.mock.calls[0][0]);
}

describe('ShopeeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(TIMESTAMP * 1000);
    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('assinatura HMAC-SHA256', () => {
    it('assina chamada de loja com partner_id + caminho + timestamp + token + shop_id', async () => {
      mockedAxios.get.mockResolvedValue({ data: { shop_name: 'Loja' } });

      await criarServico().getShopInfo('TOKEN_ABC', '555666');

      const url = urlChamada();
      expect(url.searchParams.get('sign')).toBe(ASSINATURA_LOJA);
      expect(url.searchParams.get('partner_id')).toBe(PARTNER_ID);
      expect(url.searchParams.get('timestamp')).toBe(String(TIMESTAMP));
      expect(url.searchParams.get('access_token')).toBe('TOKEN_ABC');
      expect(url.searchParams.get('shop_id')).toBe('555666');
    });

    it('assina chamada pública (autenticação) SEM token e shop_id na base', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'a', refresh_token: 'r', expire_in: 14400 },
      });
      const servico = criarServico();
      // handleCallback depende de state/contas; a chamada pública é exercida
      // pela renovação, que só precisa da criptografia e do AccountsService.
      Object.assign(servico, {
        encryption: { decrypt: () => 'refresh', encrypt: (v: string) => v },
        accountsService: { updateTokens: jest.fn() },
      });

      await servico.refreshAccountToken({
        id: 'conta-1',
        sellerId: '555666',
        refreshTokenEnc: 'x',
      } as never);

      const url = new URL(mockedAxios.post.mock.calls[0][0]);
      expect(url.pathname).toBe('/api/v2/auth/access_token/get');
      expect(url.searchParams.get('sign')).toBe(ASSINATURA_RENOVACAO);
      expect(url.searchParams.get('access_token')).toBeNull();
      expect(url.searchParams.get('shop_id')).toBeNull();
    });

    it('bate com a referência do openssl para a base pública', () => {
      const servico = criarServico() as unknown as {
        sign: (p: string, t: number, a?: string, s?: string) => string;
      };
      expect(servico.sign('/api/v2/auth/token/get', TIMESTAMP)).toBe(
        ASSINATURA_PUBLICA,
      );
    });
  });

  it('usa o host do Brasil por padrão', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });
    await criarServico().getShopInfo('T', '1');
    expect(urlChamada().host).toBe('openplatform.shopee.com.br');
  });

  describe('erro com HTTP 200', () => {
    it('lança erro quando a Shopee responde 200 com campo `error`', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { error: 'error_param', message: 'parâmetro inválido' },
      });
      await expect(criarServico().getShopInfo('T', '1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('trata erro de token como conexão expirada', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { error: 'invalid_access_token', message: 'expirado' },
      });
      await expect(criarServico().getShopInfo('T', '1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('limites da API', () => {
    it('recusa janela de pedidos maior que 15 dias sem chamar a Shopee', async () => {
      await expect(
        criarServico().getOrderList('T', '1', {
          timeFrom: TIMESTAMP - 16 * 86400,
          timeTo: TIMESTAMP,
        }),
      ).rejects.toThrow(/15 dias/);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('recusa mais de 50 pedidos no detalhe sem chamar a Shopee', async () => {
      const sns = Array.from({ length: 51 }, (_, i) => `SN${i}`);
      await expect(criarServico().getOrderDetail('T', '1', sns)).rejects.toThrow(
        /50/,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('mantém o id de conversa como texto (não perde precisão)', async () => {
      mockedAxios.get.mockResolvedValue({ data: { response: {} } });
      // 2^53 + 1: vira outro número se passar por Number()
      const idGrande = '9007199254740993';
      await criarServico().getConversationMessages('T', '1', idGrande);
      expect(urlChamada().searchParams.get('conversation_id')).toBe(idGrande);
    });
  });

  it('sem credenciais, falha com mensagem clara em vez de chamar a API', async () => {
    await expect(criarServico(false).getShopInfo('T', '1')).rejects.toThrow(
      /SHOPEE_PARTNER_ID/,
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
