import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditModule } from '../audit/audit.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { UserService } from './user.service';
import { User, UserSchema } from './user.schema';
import { UserController } from './user.controller';

@Module({
  imports: [
    AuditModule,
    CloudinaryModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
