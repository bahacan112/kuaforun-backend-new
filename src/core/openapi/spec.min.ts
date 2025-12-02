export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Kuaforun API',
    version: '1.0.0',
    description: 'Role-based API documentation: admin-barber, customer, public, super-admin',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'auth' },
    { name: 'admin-barber' },
    { name: 'customer' },
    { name: 'public' },
    { name: 'super-admin' },
  ],
  security: [ { bearerAuth: [] }, { apiKeyAuth: [] }, { cookieAuth: [] } ],
  components: {
    schemas: {
      AuthTokenResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer' },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
      UserModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
        },
      },
      RegisterDto: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      LoginDto: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      RefreshDto: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        required: ['refreshToken'],
      },
      VerifyEmailDto: {
        type: 'object',
        properties: { token: { type: 'string' } },
        required: ['token'],
      },
      PhoneStartDto: {
        type: 'object',
        properties: { phone: { type: 'string' } },
        required: ['phone'],
      },
      PhoneVerifyDto: {
        type: 'object',
        properties: { phone: { type: 'string' }, code: { type: 'string' } },
        required: ['phone', 'code'],
      },
      PasswordResetEmailStartDto: {
        type: 'object',
        properties: { email: { type: 'string' } },
        required: ['email'],
      },
      PasswordResetEmailVerifyDto: {
        type: 'object',
        properties: { email: { type: 'string' }, code: { type: 'string' } },
        required: ['email', 'code'],
      },
      PasswordResetEmailResetDto: {
        type: 'object',
        properties: { email: { type: 'string' }, code: { type: 'string' }, newPassword: { type: 'string' } },
        required: ['email', 'code', 'newPassword'],
      },
      PasswordResetPhoneStartDto: {
        type: 'object',
        properties: { phone: { type: 'string' } },
        required: ['phone'],
      },
      PasswordResetPhoneVerifyDto: {
        type: 'object',
        properties: { phone: { type: 'string' }, code: { type: 'string' } },
        required: ['phone', 'code'],
      },
      PasswordResetPhoneResetDto: {
        type: 'object',
        properties: { phone: { type: 'string' }, code: { type: 'string' }, newPassword: { type: 'string' } },
        required: ['phone', 'code', 'newPassword'],
      },
      ValidateDto: {
        type: 'object',
        properties: { token: { type: 'string' } },
        required: ['token'],
      },
      ShopModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          gender: { type: 'string', enum: ['male','female','unisex'] },
          ownerUserId: { type: 'string' },
          tenantId: { type: 'string' },
        },
      },
      ShopCreateDto: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          gender: { type: 'string', enum: ['male','female','unisex'] },
          ownerUserId: { type: 'string' },
        },
        required: ['name','address','phone'],
      },
      ShopUpdateDto: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          gender: { type: 'string', enum: ['male','female','unisex'] },
        },
      },
      ServiceModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          shopId: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          durationMinutes: { type: 'integer' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
      },
      ServiceCreateDto: {
        type: 'object',
        properties: {
          shopId: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          durationMinutes: { type: 'integer' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['shopId','name','price','durationMinutes'],
      },
      ServiceUpdateDto: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          durationMinutes: { type: 'integer' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
      },
      StaffModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          shopId: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
        },
      },
      StaffCreateDto: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['name'],
      },
      StaffUpdateDto: {
        type: 'object',
        properties: { name: { type: 'string' }, role: { type: 'string' } },
      },
      BookingModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          shopId: { type: 'string' },
          staffId: { type: 'string' },
          serviceId: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          status: { type: 'string' },
        },
      },
      BookingCreateDto: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          shopId: { type: 'string' },
          staffId: { type: 'string' },
          serviceId: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
        },
        required: ['customerId','shopId','serviceId','date'],
      },
      PaymentModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          bookingId: { type: 'string' },
          customerId: { type: 'string' },
          shopId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: { type: 'string' },
          method: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaymentCreateDto: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string', default: 'TRY' },
          method: { type: 'string', enum: ['cash','card','online'] },
        },
        required: ['amount','currency','method'],
      },
      CommentModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          shopId: { type: 'string' },
          userId: { type: 'string' },
          rating: { type: 'number' },
          text: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MediaModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          shopId: { type: 'string' },
          url: { type: 'string' },
          type: { type: 'string', enum: ['image','video'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      StaffHourModel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          day: { type: 'integer', minimum: 0, maximum: 6 },
          start: { type: 'string', example: '09:00' },
          end: { type: 'string', example: '18:00' },
          isBreak: { type: 'boolean' },
        },
      },
      StaffHoursCreateDto: {
        type: 'object',
        properties: { day: { type: 'integer' }, start: { type: 'string' }, end: { type: 'string' }, isBreak: { type: 'boolean' } },
        required: ['day','start','end'],
      },
      StaffHoursUpdateDto: {
        type: 'object',
        properties: { start: { type: 'string' }, end: { type: 'string' }, isBreak: { type: 'boolean' } },
      },
      ShopHourModel: {
        type: 'object',
        properties: { id: { type: 'string' }, day: { type: 'integer' }, open: { type: 'string' }, close: { type: 'string' } },
      },
      ShopHoursCreateDto: {
        type: 'object',
        properties: { day: { type: 'integer' }, open: { type: 'string' }, close: { type: 'string' } },
        required: ['day','open','close'],
      },
      ShopHoursUpdateDto: {
        type: 'object',
        properties: { open: { type: 'string' }, close: { type: 'string' } },
      },
      ImportSerpApiDto: {
        type: 'object',
        properties: {
          lat: { type: 'number', example: 41.0082 },
          lng: { type: 'number', example: 28.9784 },
          query: { type: 'string', example: 'barber' },
          lang: { type: 'string', example: 'tr' },
          zoom: { type: 'number', example: 18 },
          radius: { type: 'number', example: 300 },
          limit: { type: 'number', example: 20 },
          tenantId: { type: 'string' },
        },
        required: ['lat','lng','query'],
      },
      UploadGooglePhotoDto: {
        type: 'object',
        properties: {
          photoReference: { type: 'string' },
          width: { type: 'number', default: 1280 },
        },
        required: ['photoReference'],
      },
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Authorization: Bearer <token>' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Optional API Key header' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'auth_token', description: 'Cookie-based session token' },
    },
    parameters: {
      TenantId: { in: 'header', name: 'X-Tenant-Id', schema: { type: 'string' }, required: false, description: 'Tenant identifier (default kuaforun)' },
      UserId: { in: 'header', name: 'X-User-Id', schema: { type: 'string' }, required: false, description: 'Authenticated user id' },
      UserRole: { in: 'header', name: 'X-User-Role', schema: { type: 'string' }, required: false, description: 'User role: customer, salon_owner, manager, admin' },
    }
  },
  paths: {
    '/admin-barber/shops': {
      get: {
        tags: ['admin-barber'],
        summary: 'Dükkanları listele (admin-barber)',
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ShopModel' } } } } } } } },
      },
      post: {
        tags: ['admin-barber'],
        summary: 'Yeni dükkan oluştur (admin-barber)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopCreateDto' }, examples: { default: { value: { name: 'Kuaför ABC', address: 'İstanbul...', phone: '+90 555 ...', gender: 'unisex' } } } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } } },
      },
    },
    '/admin-barber/shops/{id}': {
      patch: {
        tags: ['admin-barber'],
        summary: 'Dükkanı güncelle (admin-barber)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopUpdateDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } } },
      },
      delete: { tags: ['admin-barber'], summary: 'Dükkanı sil (admin-barber)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/admin-barber/services': {
      get: { tags: ['admin-barber'], summary: 'Hizmetleri listele (admin-barber)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ServiceModel' } } } } } } } } },
      post: { tags: ['admin-barber'], summary: 'Yeni hizmet oluştur (admin-barber)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceCreateDto' }, examples: { default: { value: { shopId: 'uuid', name: 'Saç Kesimi', price: 250, durationMinutes: 45 } } } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ServiceModel' } } } } } } } },
    },
    '/admin-barber/services/{id}': {
      patch: { tags: ['admin-barber'], summary: 'Hizmeti güncelle (admin-barber)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceUpdateDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ServiceModel' } } } } } } } },
      delete: { tags: ['admin-barber'], summary: 'Hizmeti sil (admin-barber)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/admin-barber/notifications': {
      get: { tags: ['admin-barber'], summary: 'Bildirimleri listele (admin-barber)', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin-barber/shops/{id}/staff': { get: { tags: ['admin-barber'], summary: 'Dükkan personelini listele (admin-barber)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/StaffModel' } } } } } } } } } , post: { tags: ['admin-barber'], summary: 'Dükkana personel ekle (admin-barber)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StaffCreateDto' } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/StaffModel' } } } } } } } } },
    '/admin-barber/shops/{id}/staff/{staffId}/hours': {
      get: { tags: ['admin-barber'], summary: 'Personel saatlerini listele', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/StaffHourModel' } } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
      post: { tags: ['admin-barber'], summary: 'Personel saat ekle', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StaffHoursCreateDto' } } } }, responses: { '201': { description: 'Created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin-barber/shops/{id}/staff/{staffId}/hours/{hourId}': {
      patch: { tags: ['admin-barber'], summary: 'Personel saat güncelle', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StaffHoursUpdateDto' } } } }, responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['admin-barber'], summary: 'Personel saat sil', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
    },
    '/admin-barber/shops/{id}/hours': {
      get: { tags: ['admin-barber'], summary: 'Dükkan çalışma saatleri', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ShopHourModel' } } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
      post: { tags: ['admin-barber'], summary: 'Dükkan saat ekle', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopHoursCreateDto' } } } }, responses: { '201': { description: 'Created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/admin-barber/shops/{id}/hours/{hourId}': {
      patch: { tags: ['admin-barber'], summary: 'Dükkan saat güncelle', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopHoursUpdateDto' } } } }, responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['admin-barber'], summary: 'Dükkan saat sil', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
    },
    '/admin-barber/shops/{id}/staff/{staffId}': {
      patch: { tags: ['admin-barber'], summary: 'Personeli güncelle (admin-barber)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StaffUpdateDto' }, examples: { default: { value: { name: 'Yeni İsim', role: 'barber' } } } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/StaffModel' } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['admin-barber'], summary: 'Personeli sil (admin-barber)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } },
    },
    '/public/shops': { get: { tags: ['public'], summary: 'Dükkanları listele (public)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ShopModel' } } } } } } } } } },
    '/public/shops/{id}': { get: { tags: ['public'], summary: 'Dükkan detayı (public)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } } } } },
    '/public/comments': { get: { tags: ['public'], summary: 'Yorumları listele (public)', parameters: [ { in: 'query', name: 'shopId', schema: { type: 'string' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } } ], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/CommentModel' } } } } } } } } } },
    '/public/media': { get: { tags: ['public'], summary: 'Medya listesi (public)', parameters: [ { in: 'query', name: 'shopId', schema: { type: 'string' } }, { in: 'query', name: 'type', schema: { type: 'string', enum: ['image','video'] } } ], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/MediaModel' } } } } } } } } } },
    '/public/openstreetmap/search': { get: { tags: ['public'], summary: 'Adres arama (public)', security: [], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } } },
    '/public/openstreetmap/reverse': { get: { tags: ['public'], summary: 'Koordinattan adres (public)', security: [], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } } },
    '/customer/bookings': {
      get: { tags: ['customer'], summary: 'Randevuları listele (customer)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { bookings: { type: 'array', items: { $ref: '#/components/schemas/BookingModel' } } } } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
      post: { tags: ['customer'], summary: 'Randevu oluştur (customer)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingCreateDto' }, examples: { default: { value: { customerId: 'uuid', shopId: 'uuid', staffId: 'uuid', serviceId: 'uuid', date: '2025-12-01T10:00:00Z' } } } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/BookingModel' } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/customer/bookings/{id}': { patch: { tags: ['customer'], summary: 'Randevu güncelle (customer)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingUpdateDto' }, examples: { default: { value: { staffId: 'uuid', serviceId: 'uuid', date: '2025-12-02T11:00:00Z' } } } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/BookingModel' } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } } },
    '/customer/bookings/{id}/cancel': { post: { tags: ['customer'], summary: 'Randevu iptal (customer)', requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/CancelBookingDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } } },
    '/customer/favorites/shops': { get: { tags: ['customer'], summary: 'Favori dükkanlar (customer)', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/customer/favorites/shops/{shopId}': { post: { tags: ['customer'], summary: 'Favori ekle (customer)', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } }, delete: { tags: ['customer'], summary: 'Favori kaldır (customer)', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } } },
    '/customer/payments': { get: { tags: ['customer'], summary: 'Ödemeleri listele (customer)', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/PaymentModel' } } } } } } } } }, post: { tags: ['customer'], summary: 'Ödeme oluştur (customer)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateDto' }, examples: { default: { value: { bookingId: 'uuid', amount: 250, currency: 'TRY', method: 'card' } } } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PaymentModel' } } } } } } } } },
    '/super-admin/tenants': {
      get: { tags: ['super-admin'], summary: 'Tenant listesi' },
    },
    '/super-admin/tenants/{tenantId}/summary': {
      get: { tags: ['super-admin'], summary: 'Tenant özeti' },
    },
    '/super-admin/analytics/summary': {
      get: { tags: ['super-admin'], summary: 'Analitik özeti' },
    },
    '/super-admin/analytics/metrics': {
      get: { tags: ['super-admin'], summary: 'Prometheus metrikleri' },
    },
    '/super-admin/shops': {
      get: { tags: ['super-admin'], summary: 'Berberleri listele (super-admin)', parameters: [ { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }, { in: 'query', name: 'name', schema: { type: 'string' } }, { in: 'query', name: 'city', schema: { type: 'string' } }, { in: 'query', name: 'gender', schema: { type: 'string', enum: ['male','female','unisex'] } }, { in: 'query', name: 'ownerOnly', schema: { type: 'string' } }, { in: 'query', name: 'ownerId', schema: { type: 'string', format: 'uuid' } } ], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ShopModel' } }, pagination: { type: 'object' } } } } } } } },
      post: { tags: ['super-admin'], summary: 'Berber oluştur (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopCreateDto' } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } } } },
    },
    '/super-admin/shops/{id}': { patch: { tags: ['super-admin'], summary: 'Berber güncelle (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopUpdateDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } }, '404': { description: 'Not Found' } } }, delete: { tags: ['super-admin'], summary: 'Berber sil (super-admin)', responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } } },
    '/super-admin/shops/{id}/owner': { post: { tags: ['super-admin'], summary: 'Berber owner atama', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', format: 'uuid' } }, required: ['userId'] } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ShopModel' } } } } } }, '400': { description: 'Bad Request' }, '404': { description: 'Not Found' } } } },
    '/super-admin/shops/import-serpapi': {
      post: { tags: ['super-admin'], summary: 'SerpAPI import (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportSerpApiDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { inserted: { type: 'integer' }, skipped: { type: 'integer' }, updated: { type: 'integer' }, insertedIds: { type: 'array', items: { type: 'string' } }, updatedIds: { type: 'array', items: { type: 'string' } } } } } } } } },
    },
    '/super-admin/shops/{id}/photos/upload-google': {
      post: { tags: ['super-admin'], summary: 'Google photo upload (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UploadGooglePhotoDto' } } } }, responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' }, '404': { description: 'Not Found' } } },
    },
    '/super-admin/services': {
      get: { tags: ['super-admin'], summary: 'Hizmetleri listele (super-admin)', parameters: [ { in: 'query', name: 'shopId', schema: { type: 'string', format: 'uuid' } }, { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } } ], responses: { '200': { description: 'OK' } } },
      post: { tags: ['super-admin'], summary: 'Hizmet oluştur (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceCreateDto' }, examples: { default: { value: { shopId: 'uuid', name: 'Saç Kesimi', price: 250, durationMinutes: 45 } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/super-admin/services/{id}': {
      patch: { tags: ['super-admin'], summary: 'Hizmet güncelle (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceUpdateDto' } } } }, responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['super-admin'], summary: 'Hizmet sil (super-admin)', responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
    },
    '/super-admin/users': {
      get: { tags: ['super-admin'], summary: 'Kullanıcı listesi (super-admin)', parameters: [ { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } } ], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/UserModel' } }, pagination: { type: 'object' } } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
      post: { tags: ['super-admin'], summary: 'Kullanıcı profili oluştur (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfileCreateDto' }, examples: { default: { value: { id: 'uuid', bio: '...', city: 'İstanbul' } } } } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } }, '400': { description: 'Bad Request' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/super-admin/users/{id}': { get: { tags: ['super-admin'], summary: 'Kullanıcı detayı', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } }, '404': { description: 'Not Found' } } }, put: { tags: ['super-admin'], summary: 'Kullanıcı güncelle', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfileUpdateDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } }, delete: { tags: ['super-admin'], summary: 'Kullanıcı sil', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not Found' } } } },
    '/super-admin/users/profile': { get: { tags: ['super-admin'], summary: 'Aktif kullanıcı profili', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } }, '401': { description: 'Unauthorized' } } } },
    '/super-admin/users/auth/{authUserId}': { get: { tags: ['super-admin'], summary: 'Auth ID üzerinden kullanıcı', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } }, '404': { description: 'Not Found' } } } },
    '/super-admin/logs': {
      get: { tags: ['super-admin'], summary: 'Log listesi (super-admin)', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
      post: { tags: ['super-admin'], summary: 'Log oluştur (super-admin)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } },
    },
    '/super-admin/logs/stats': { get: { tags: ['super-admin'], summary: 'Log istatistikleri', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/super-admin/logs/aggregation': { get: { tags: ['super-admin'], summary: 'Log agregasyon', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/super-admin/logs/cleanup': { delete: { tags: ['super-admin'], summary: 'Eski logları sil', responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Giriş',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' }, examples: { default: { value: { email: 'user@example.com', password: 'secret' } } } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokenResponse' } } } } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Token yenile',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokenResponse' } } } } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'Kayıt ol',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterDto' }, examples: { default: { value: { email: 'user@example.com', password: 'secret', name: 'User' } } } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['auth'],
        summary: 'Email doğrula',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/resend-verification': {
      post: {
        tags: ['auth'],
        summary: 'Doğrulama tekrar gönder',
        requestBody: { required: false },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/health': {
      get: { tags: ['auth'], summary: 'Auth sağlığı', responses: { '200': { description: 'OK' } } },
    },
    '/auth/login/phone': {
      post: {
        tags: ['auth'],
        summary: 'Telefon ile giriş',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { phone: { type: 'string' }, code: { type: 'string' } }, required: ['phone', 'code'] } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokenResponse' } } } } },
      },
    },
    '/auth/phone/start': {
      post: {
        tags: ['auth'],
        summary: 'Telefon doğrulama başlat',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneStartDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/phone/verify': {
      post: {
        tags: ['auth'],
        summary: 'Telefon doğrulama',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneVerifyDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/phone/verify-and-set': {
      post: {
        tags: ['auth'],
        summary: 'Telefonu doğrula ve ayarla',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneVerifyDto' } } } },
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/auth/users/{id}': {
      get: { tags: ['auth'], summary: 'Kullanıcı getir', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } } } },
    },
    '/auth/password-reset/email/start': {
      post: { tags: ['auth'], summary: 'Şifre sıfırlama (email) başlat', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetEmailStartDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/password-reset/email/verify': {
      post: { tags: ['auth'], summary: 'Şifre sıfırlama (email) doğrula', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetEmailVerifyDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/password-reset/email/reset': {
      post: { tags: ['auth'], summary: 'Şifre sıfırla (email)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetEmailResetDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/password-reset/phone/start': {
      post: { tags: ['auth'], summary: 'Şifre sıfırlama (telefon) başlat', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetPhoneStartDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/password-reset/phone/verify': {
      post: { tags: ['auth'], summary: 'Şifre sıfırlama (telefon) doğrula', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetPhoneVerifyDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/password-reset/phone/reset': {
      post: { tags: ['auth'], summary: 'Şifre sıfırla (telefon)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordResetPhoneResetDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/validate': {
      post: { tags: ['auth'], summary: 'Token doğrula', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateDto' } } } }, responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
    '/auth/me': {
      get: { tags: ['auth'], summary: 'Mevcut kullanıcı', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserModel' } } } } } },
    },
    '/auth/logout': {
      post: { tags: ['auth'], summary: 'Çıkış', responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } } },
    },
  },
}
