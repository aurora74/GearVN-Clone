import {
  Get,
  Put,
  Body,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  Controller,
} from '@nestjs/common';
import {
  ApiBody,
  ApiTags,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

import { OrderService } from './order.service';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiBody({ type: CreateOrderDto })
  create(@Body() dto: CreateOrderDto, @Request() req) {
    return this.orderService.create(dto, req.user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
  })
  @ApiQuery({ name: 'orderStatus', required: false, type: String })
  findMyOrders(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
    @Query('orderStatus') orderStatus?: string,
  ) {
    return this.orderService.findMyOrders(req.user.id, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      sortBy: sortBy || '-createdAt',
      fields,
      orderStatus,
    });
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'orderStatus', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String })
  @ApiQuery({ name: 'totalFrom', required: false, type: Number })
  @ApiQuery({ name: 'totalTo', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  findOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
    @Query('orderStatus') orderStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('totalFrom') totalFrom?: number,
    @Query('totalTo') totalTo?: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.orderService.findOrders({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      sortBy: sortBy || '-createdAt',
      fields,
      orderStatus,
      paymentStatus,
      paymentMethod,
      totalFrom,
      totalTo,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Get('code/:code')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'code', type: String })
  findByCode(@Param('code') code: string) {
    return this.orderService.findByCode(code);
  }

  @Put('status/:id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateOrderStatusDto })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto.orderStatus);
  }

  @Put('cancel/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', type: String })
  cancelOrder(@Param('id') id: string) {
    return this.orderService.cancelOrder(id);
  }
}
