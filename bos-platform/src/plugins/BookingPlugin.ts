import { Service } from 'typedi';
import { BasePlugin, IPluginContext } from './BasePlugin';

@Service()
export class BookingPlugin extends BasePlugin {
  public config = {
    id: 'booking',
    name: 'Booking & Scheduling Platform',
    version: '1.0.0',
    dependencies: ['saas'],
    configSchema: {
      slotDuration: { type: 'number', default: 30 }, // minutes
      bookingWindow: { type: 'number', default: 30 }, // days in advance
      cancellationPolicy: { type: 'string', enum: ['flexible', 'moderate', 'strict'], default: 'moderate' },
      enableWaitingList: { type: 'boolean', default: true }
    },
    models: {
      Service: {
        fields: {
          name: { type: 'string' },
          description: { type: 'string' },
          duration: { type: 'number' }, // minutes
          price: { type: 'number' },
          providerId: { type: 'string' },
          tenantId: { type: 'string' }
        }
      },
      Availability: {
        fields: {
          providerId: { type: 'string' },
          dayOfWeek: { type: 'number' }, // 0-6
          startTime: { type: 'string' }, // HH:mm
          endTime: { type: 'string' }, // HH:mm
          tenantId: { type: 'string' }
        }
      },
      Appointment: {
        fields: {
          serviceId: { type: 'string' },
          providerId: { type: 'string' },
          userId: { type: 'string' },
          startTime: { type: 'date' },
          endTime: { type: 'date' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
          notes: { type: 'string' },
          tenantId: { type: 'string' }
        }
      },
      Review: {
        fields: {
          appointmentId: { type: 'string' },
          userId: { type: 'string' },
          rating: { type: 'number', min: 1, max: 5 },
          comment: { type: 'string' },
          tenantId: { type: 'string' }
        }
      }
    },
    flows: {
      'slot.search': 'Find available time slots',
      'appointment.book': 'Book appointment with confirmation',
      'appointment.cancel': 'Cancel appointment with policy check',
      'appointment.reschedule': 'Reschedule existing appointment'
    }
  };

  public async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);
    this.logger.info(`[Booking] Initialized for tenant ${context.tenantId}`);
  }

  public async execute(flowName: string, input: any, context: IPluginContext): Promise<any> {
    switch (flowName) {
      case 'slot.search':
        return await this.handleSlotSearch(input, context);
      case 'appointment.book':
        return await this.handleAppointmentBook(input, context);
      case 'appointment.cancel':
        return await this.handleAppointmentCancel(input, context);
      case 'appointment.reschedule':
        return await this.handleAppointmentReschedule(input, context);
      default:
        throw new Error(`Unknown flow: ${flowName}`);
    }
  }

  private async handleSlotSearch(input: any, context: IPluginContext): Promise<any> {
    const { serviceId, providerId, date, duration } = input;
    
    // Get provider availability
    // Filter out booked slots
    // Return available slots
    
    return {
      availableSlots: [
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '10:00', endTime: '10:30' },
        { startTime: '14:00', endTime: '14:30' }
      ],
      date,
      serviceId
    };
  }

  private async handleAppointmentBook(input: any, context: IPluginContext): Promise<any> {
    const { serviceId, providerId, userId, startTime, notes } = input;
    
    // Check slot availability
    // Create appointment
    // Send confirmation email/SMS
    // Block calendar
    
    return {
      appointmentId: `appt_${Date.now()}`,
      serviceId,
      providerId,
      userId,
      startTime,
      endTime: new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString(),
      status: 'confirmed',
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    };
  }

  private async handleAppointmentCancel(input: any, context: IPluginContext): Promise<any> {
    const { appointmentId, reason } = input;
    
    // Get appointment
    // Check cancellation policy
    // Process refund if applicable
    // Update status
    // Notify provider
    
    return {
      appointmentId,
      status: 'cancelled',
      refundAmount: 0,
      cancelledAt: new Date().toISOString()
    };
  }

  private async handleAppointmentReschedule(input: any, context: IPluginContext): Promise<any> {
    const { appointmentId, newStartTime } = input;
    
    // Check new slot availability
    // Update appointment time
    // Send updated confirmation
    
    return {
      appointmentId,
      oldStartTime: '2024-01-15T10:00:00Z',
      newStartTime,
      rescheduledAt: new Date().toISOString()
    };
  }
}
