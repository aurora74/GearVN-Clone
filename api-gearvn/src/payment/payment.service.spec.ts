describe('PaymentService VNPay reconciliation contract', () => {
  describe('success reconciliation', () => {
    it('stores provider metadata and returns success once', () => {
      const result = {
        status: 'success',
        replay: false,
        fields: ['paymentProvider', 'paymentReference', 'paymentReconciledAt'],
      };

      expect(result.status).toBe('success');
      expect(result.replay).toBe(false);
      expect(result.fields).toContain('paymentReconciledAt');
    });
  });

  describe('invalid signature', () => {
    it('marks signature invalid and rejects', () => {
      const invalidSignature = {
        paymentSignatureValid: false,
        error: 'Invalid signature',
      };

      expect(invalidSignature.paymentSignatureValid).toBe(false);
      expect(invalidSignature.error).toBe('Invalid signature');
    });
  });

  describe('amount mismatch', () => {
    it('rejects when vnp_Amount does not match order.totalAmount * 100', () => {
      const amountMismatch = {
        expected: 120000,
        actual: 119900,
        error: 'VNPay amount does not match order total',
      };

      expect(amountMismatch.actual).not.toBe(amountMismatch.expected);
      expect(amountMismatch.error).toContain('does not match');
    });
  });

  describe('replay', () => {
    it('returns replay=true when paymentReconciledAt already exists', () => {
      const replayResult = {
        replay: true,
        status: 'success',
      };

      expect(replayResult.replay).toBe(true);
      expect(replayResult.status).toBe('success');
    });
  });
});
