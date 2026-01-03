import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EventSchema } from './event.schema';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    CloudinaryModule,
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
  ],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
