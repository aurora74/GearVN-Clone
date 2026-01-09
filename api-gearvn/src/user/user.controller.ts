import {
  Get,
  Put,
  Post,
  Body,
  Patch,
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

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/auth/policy/permissions';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { CreateManagerDto } from './dto/create-manager.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AccountActionDto } from './dto/account-action.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}


  @Post('managers')
  @ApiBearerAuth()
  @Permissions(Permission.ACCOUNT_MANAGER_CREATE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiBody({ type: CreateManagerDto })
  async createManager(@Body() dto: CreateManagerDto, @Request() req) {
    return this.userService.createManager(dto, req.user, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('staff')
  @ApiBearerAuth()
  @Permissions(Permission.STAFF_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiBody({ type: CreateStaffDto })
  async createStaff(@Body() dto: CreateStaffDto, @Request() req) {
    return this.userService.createStaff(dto, req.user, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  getMe(@Request() req) {
    return this.userService.getMe(req.user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiBody({ type: UpdateProfileDto })
  updateMe(@Body() body: UpdateProfileDto, @Request() req) {
    return this.userService.updateProfile(req.user.id, body);
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

  @Get('staff')
  @ApiBearerAuth()
  @Permissions(Permission.STAFF_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
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
    description: 'e.g: fullName,email,status,role',
  })
  findStaff(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.userService.findStaff({
      page,
      limit,
      search,
      sortBy,
      fields,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string, @Request() req) {
    return this.userService.findOne(id, req.user);
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
    @Body() body: UpdateProfileDto,
    @UploadedFile() avatar: Express.Multer.File | undefined,
    @Request() req,
  ) {
    return this.userService.updateProfile(req.user.id, body, avatar);
  }

  @Patch('staff/:id')
  @ApiBearerAuth()
  @Permissions(Permission.STAFF_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  @ApiBody({ type: UpdateStaffDto })
  updateStaff(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @Request() req,
  ) {
    return this.userService.updateStaff(req.user, id, body, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateAccountStatusDto })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAccountStatusDto,
    @Request() req,
  ) {
    return this.userService.governAccountStatus(req.user, id, body.status, body, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }


  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', required: true })
  @ApiBody({ type: AccountActionDto })
  async remove(
    @Param('id') id: string,
    @Body() action: AccountActionDto,
    @Request() req,
  ) {
    return this.userService.governAccountDeletion(req.user, id, action, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}
