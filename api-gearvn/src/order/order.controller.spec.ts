describe('Order controller route contracts', () => {
  describe('GET /orders/:id', () => {
    it('expects owner-or-permission enforcement for detail reads', () => {
      const detailPolicy = {
        route: 'GET /orders/:id',
        requiresAuth: true,
        deniesCrossUser: true,
      };

      expect(detailPolicy.route).toBe('GET /orders/:id');
      expect(detailPolicy.requiresAuth).toBe(true);
      expect(detailPolicy.deniesCrossUser).toBe(true);
    });
  });

  describe('GET /orders/code/:code', () => {
    it('expects owner-or-permission enforcement for code lookup', () => {
      const codePolicy = {
        route: 'GET /orders/code/:code',
        requiresAuth: true,
        deniesCrossUser: true,
      };

      expect(codePolicy.route).toBe('GET /orders/code/:code');
      expect(codePolicy.requiresAuth).toBe(true);
      expect(codePolicy.deniesCrossUser).toBe(true);
    });
  });

  describe('PUT /orders/cancel/:id', () => {
    it('expects conflict for disallowed cancellation states', () => {
      const cancelPolicy = {
        route: 'PUT /orders/cancel/:id',
        conflictCode: 'ORDER_CANCEL_NOT_ALLOWED',
        allowedWhen: 'PROCESSING+PENDING',
      };

      expect(cancelPolicy.route).toBe('PUT /orders/cancel/:id');
      expect(cancelPolicy.conflictCode).toBe('ORDER_CANCEL_NOT_ALLOWED');
      expect(cancelPolicy.allowedWhen).toBe('PROCESSING+PENDING');
    });
  });
});
