import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [PrismaModule, StorageModule, CacheModule],
  exports: [PrismaModule, StorageModule, CacheModule],
})
export class SharedModule {}
