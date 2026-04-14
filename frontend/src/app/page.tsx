import Image from "next/image";
import { Menu, Activity, ChevronRight, MessageSquare, LayoutGrid, Banknote, Mail, User } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-[#1A1A1A]">
      {/* HEADER */}
      <header className="px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <Menu className="w-6 h-6 text-gray-800" strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="Central Seller Hub Logo" 
              width={64} 
              height={64}
              className="object-contain"
            />
            <h1 className="text-2xl font-bold text-[#e67500]">Central Seller Hub</h1>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 shadow-sm relative shrink-0">
          <div className="absolute inset-0 bg-[#333] flex justify-center items-end">
            {/* Generic placeholder avatar silhouette to match the black circle styling */}
             <User className="text-[#F8F9FA] w-8 h-8 translate-y-2 fill-current" />
          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <main className="px-6 space-y-6">
        
        {/* PAGE TITLE */}
        <div className="space-y-1 mt-2">
          <h2 className="text-[28px] font-bold tracking-tight text-[#111827]">Meus CNPJs</h2>
          <p className="text-[#5B657A] text-base leading-relaxed max-w-[280px]">
            Gerencie suas contas conectadas e integrações em tempo real.
          </p>
        </div>

        {/* TOP SUMMARY CARDS */}
        <div className="flex gap-4">
          {/* Card 1 */}
          <div className="bg-[#DE7100] flex-1 rounded-3xl p-5 text-white shadow-md shadow-orange-500/20">
            <p className="text-xs font-semibold tracking-wider opacity-90 mb-1">TOTAL DE CONTAS</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[40px] font-semibold leading-none tracking-tight">12</span>
              <span className="text-sm font-medium">CNPJs Ativos</span>
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="bg-white rounded-3xl p-5 flex flex-col justify-center shadow-sm w-[130px]">
             <div className="flex items-center gap-2 text-[#9A5013]">
                <Activity className="w-5 h-5" />
                <span className="text-[28px] font-bold leading-none text-[#9A5013]">08</span>
             </div>
             <p className="text-xs font-bold text-gray-400 mt-2 tracking-wide uppercase">Online <br/> Agora</p>
          </div>
        </div>

        {/* ACTION BUTTON */}
        <button className="w-full bg-white rounded-3xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFEFE5] flex items-center justify-center shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#DE7100]"><path d="M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10Z"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 2v4"/><path d="M16 10v4"/><path d="M8 10v4"/><path d="M12 10v4"/><path d="M10 22v-4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v4"/><rect x="15" y="16" width="8" height="8" rx="2" fill="white" stroke="white" strokeWidth="0"/><path d="M19 16v8M15 20h8" color="#DE7100" strokeWidth="2.5" /></svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Adicionar Novo CNPJ</h3>
              <p className="text-sm font-medium italic text-gray-500">Shopee, Amazon ou Mercado Livre</p>
            </div>
          </div>
          <ChevronRight className="text-[#DE7100] w-6 h-6 mr-1" strokeWidth={3} />
        </button>

        {/* ACCOUNTS LIST */}
        <div className="space-y-4">
          {/* Card 1: Mercado Livre */}
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-black rounded-[0.8rem] flex items-center justify-center shrink-0">
                   <div className="h-6 w-6 font-bold text-xl text-[#00E5FF] flex items-center justify-center tracking-tighter" style={{ fontFamily: "serif" }}><span className="text-yellow-400">M</span></div>
                </div>
                <div className="flex flex-col h-full justify-between py-0.5">
                  <h4 className="font-bold text-xl text-gray-900 leading-none">Tech Solutions LTDA</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                     <span className="bg-[#FFF3E0] text-[#E65100] text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center">
                       Mercado <br/> Livre
                     </span>
                     <span className="text-[#8892A3] text-sm tracking-wide">12.345.678/0001-<br/>90</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                 <div className="flex items-center bg-[#EBFFF3] text-[#00A650] px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#00A650] mr-1.5"></span>
                   ONLINE
                 </div>
                 <button className="text-gray-300 hover:text-gray-500 ml-1 mt-0.5">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                 </button>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex justify-between items-end border-t border-gray-100 pt-4 px-1">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">VENDAS (MÊS)</p>
                <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">R$ 45.290</p>
              </div>
              <div>
                 <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 text-right">REPUTAÇÃO</p>
                 <div className="flex gap-1">
                   <div className="h-2.5 w-7 rounded-sm bg-[#00A650]"></div>
                   <div className="h-2.5 w-7 rounded-sm bg-[#00A650]"></div>
                   <div className="h-2.5 w-7 rounded-sm bg-[#00A650]"></div>
                 </div>
              </div>
            </div>
          </div>

          {/* Card 2: Shopee */}
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-[#EE4D2D] rounded-[0.8rem] flex items-center justify-center shrink-0">
                   <span className="h-6 w-6 relative bg-white rounded-full flex flex-col justify-center items-center shadow-inner overflow-hidden">
                      <span className="text-[#EE4D2D] font-bold text-[10px] mt-1 tracking-tighter">opee</span>
                   </span>
                </div>
                <div className="flex flex-col h-full justify-between py-0.5">
                  <h4 className="font-bold text-[19px] text-gray-900 leading-none tracking-tight">Global Imports ME</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                     <span className="bg-[#FFF3E0] text-[#E65100] text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center h-5">
                       Shopee
                     </span>
                     <span className="text-[#8892A3] text-sm tracking-wide leading-tight">98.765.432/0001-<br/>21</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                 <div className="flex items-center bg-[#F1F3F5] text-[#8892A3] px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#8892A3] mr-1.5"></span>
                   OFFLINE
                 </div>
                 <button className="text-gray-300 hover:text-gray-500 ml-1 mt-0.5">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                 </button>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex justify-between items-end border-t border-gray-100 pt-4 px-1">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">VENDAS (MÊS)</p>
                <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">R$ 12.840</p>
              </div>
              <div className="text-right">
                 <p className="text-[11px] font-bold text-[#8892A3] uppercase tracking-widest mb-1.5 text-right">PENDÊNCIAS</p>
                 <p className="text-[#EE4D2D] text-sm font-semibold tracking-wide">Reconectar Token</p>
              </div>
            </div>
          </div>

          {/* Card 3: Amazon */}
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-black rounded-[0.8rem] flex items-center justify-center shrink-0">
                   <Image src="/logo.png" className="brightness-0 invert opacity-0" alt="" width={1} height={1}/>
                   <span className="text-white font-serif font-bold text-xs tracking-tighter" style={{ marginTop: '4px' }}>amazon</span>
                </div>
                <div className="flex flex-col h-full justify-between py-0.5">
                  <h4 className="font-bold text-xl text-gray-900 leading-none">Varejo Prime Brasil</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                     <span className="bg-[#EBF1F5] text-[#2C3E50] text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center h-5">
                       Amazon
                     </span>
                     <span className="text-[#8892A3] text-sm tracking-wide leading-tight">45.000.123/0001-<br/>11</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                 <div className="flex items-center bg-[#EBFFF3] text-[#00A650] px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#00A650] mr-1.5"></span>
                   ONLINE
                 </div>
                 <button className="text-gray-300 hover:text-gray-500 ml-1 mt-0.5">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                 </button>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex justify-between items-end border-t border-gray-100 pt-4 px-1">
              <div>
                <p className="text-[11px] font-bold text-[#8892A3] uppercase tracking-widest mb-1.5">VENDAS (MÊS)</p>
                <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">R$ 89.200</p>
              </div>
              <div>
                 <p className="text-[11px] font-bold text-[#8892A3] uppercase tracking-widest mb-2.5 text-right">REPUTAÇÃO</p>
                 <div className="flex gap-1">
                   <div className="h-2.5 w-7 rounded-sm bg-[#00A650]"></div>
                   <div className="h-2.5 w-7 rounded-sm bg-[#00A650]"></div>
                   <div className="h-2.5 w-7 rounded-sm bg-[#90E0B1]"></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FAB - CHAT BUTTON */}
      <button className="fixed bottom-28 right-6 bg-[#FE8201] text-white p-4 rounded-2xl shadow-[0_8px_20px_rgba(254,130,1,0.4)] transition-transform hover:scale-105 active:scale-95 z-40">
        <MessageSquare className="w-8 h-8 fill-current" strokeWidth={1.5} />
      </button>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 w-full bg-[#F8F9FA] border-t border-gray-200/50 pb-safe pt-2 px-6 flex justify-between items-center z-50">
        <div className="flex flex-col items-center justify-center p-2 mb-2 text-[#9BA5B7] gap-1 relative w-16">
           <LayoutGrid className="w-[26px] h-[26px]" strokeWidth={2.5} />
           <span className="text-[11px] font-semibold tracking-wide">Dashboard</span>
        </div>
        
        <div className="flex flex-col items-center justify-center p-2 mb-2 text-[#9BA5B7] gap-1 relative w-16">
           <Banknote className="w-[28px] h-[28px] -ml-1" strokeWidth={2.5} />
           <span className="text-[11px] font-semibold tracking-wide">Sales</span>
        </div>

        <div className="flex flex-col items-center justify-center p-2 mb-2 text-[#9BA5B7] gap-1 relative w-16">
           <Mail className="w-[26px] h-[26px]" strokeWidth={2.5} />
           <span className="text-[11px] font-semibold tracking-wide">Messages</span>
        </div>

        <div className="flex flex-col items-center justify-center p-3 mb-2 text-[#CC5400] gap-1 relative bg-[#FEF2E8] rounded-2xl px-5 mr-[-8px]">
           <User className="w-[26px] h-[26px] fill-current" strokeWidth={1.5} />
           <span className="text-[11px] font-bold tracking-wide">Profile</span>
        </div>
      </nav>
      
      {/* Safe area padding helper for visual balance at bottom */}
      <div className="h-4"></div>
    </div>
  );
}
