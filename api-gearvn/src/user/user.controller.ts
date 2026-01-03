import {
  Get,
  Put,
  Post,
  Body,
  Query,
  Param,
  Delete,
  Request,
  UseGuards,
  Controller,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { UserService } from './user.service';
import { Roles } from 'src/auth/decorators/roles.decorator';

import { UserRole } from 'src/auth/enums/user-role.enum';
import { AccountStatus } from 'src/auth/enums/account-status.enum';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiBody({ type: CreateUserDto })
  async create(@Body() userData: CreateUserDto) {
    return this.userService.create(userData);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  getMe(@Request() req) {
    return this.userService.getMe(req.user.id);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'e.g: fullName,-createdAt',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'e.g: fullName,email,status',
  })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.userService.findAll({
      page,
      limit,
      search,
      sortBy,
      fields,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', required: true })
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.userService.update(id, body, avatar);
  }

  @Put('status/:id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiParam({ name: 'id' })
  @UseGuards(JwtGuard, RolesGuard)
  @ApiBody({ schema: { example: { status: 'banned' } } })
  updateStatus(@Param('id') id: string, @Body('status') status: AccountStatus) {
    return this.userService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', required: true })
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
