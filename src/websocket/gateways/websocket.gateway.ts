import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DataService } from 'src/data/services/data.service';
import { DataPoint } from 'src/data/schemas/data-point.schema';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedClients = new Map<string, Socket>();
  private roomSubscriptions = new Map<string, Set<string>>();

  constructor(private readonly dataService: DataService) {}

  afterInit(server: Server) {
    this.logger.log('Websocket server initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);

    this.roomSubscriptions.forEach((sockets, room) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.roomSubscriptions.delete(room);
      }
    });
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; userId?: string },
  ) {
    try {
      if (data.token || data.userId) {
        client.data.authenticated = true;
        client.data.userId = data.userId;
        client.emit('authenticated', { success: true });
        this.logger.log(`Client authenticated: ${client.id}`);
      } else {
        client.emit('authentication', {
          success: false,
          message: 'Unauthorized',
        });
      }
    } catch (error) {
      this.logger.error(
        `Error in authenticate handler for ${client.id}:`,
        error,
      );
      client.emit('error', {
        message: 'Authentication failed',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (!client.data.authenticated) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    const { room } = data;
    client.join(room);

    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room)!.add(client.id);

    client.emit(`subscribed`, { room });
    this.logger.log(`Client ${client.id} subscribed to room: ${room}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const { room } = data;
    client.leave(room);

    const roomSubs = this.roomSubscriptions.get(room);
    if (roomSubs) {
      roomSubs.delete(client.id);
      if (roomSubs.size === 0) {
        this.roomSubscriptions.delete(room);
      }
    }

    client.emit('unsubscribed', { room });
    this.logger.log(`Client ${client.id} unsubscribed from room: ${room}`);
  }

  @SubscribeMessage('submit_data')
  async handleSubmitData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DataPoint[],
  ) {
    if (!client.data.authenticated) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }
    try {
      await this.dataService.ingestData(data as any);
      client.emit('data_received', {
        count: data.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error processing real-time data:', error);
      client.emit('error', { message: 'Failed to process data' });
    }
  }

  broadcastData(data: any): void {
    this.server.emit('data_update', {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  sendToClient(socketId: string, event: string, data: any): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.emit(event, {
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    roomSubscriptions: Record<string, number>;
  } {
    const authenticatedCount = Array.from(
      this.connectedClients.values(),
    ).filter((socket) => socket.data.authenticated).length;

    const roomStats: Record<string, number> = {};
    this.roomSubscriptions.forEach((sockets, room) => {
      roomStats[room] = sockets.size;
    });

    return {
      totalConnections: this.connectedClients.size,
      authenticatedConnections: authenticatedCount,
      roomSubscriptions: roomStats,
    };
  }
}
