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

  @Prop({ required: true, type: Date })
  startsAt: Date;

  @Prop({ required: true, type: Date })
  endsAt: Date;

  @Prop({ type: Boolean, default: true })
  isEnabled: boolean;

  @Prop({ type: Date })
  disabledAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
