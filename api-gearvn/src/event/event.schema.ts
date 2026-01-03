import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  frame: string;

  @Prop()
  image?: string;

  @Prop({ required: true })
  tag: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
