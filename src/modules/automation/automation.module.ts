import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AutomationService } from './automation.service';
import { KnowledgeService } from './knowledge.service';
import { AnswerTemplate } from './entities/answer-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnswerTemplate]), ConfigModule],
  providers: [AutomationService, KnowledgeService],
  exports: [AutomationService, KnowledgeService],
})
export class AutomationModule {}
