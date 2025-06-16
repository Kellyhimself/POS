export const schema = {
  // ... existing tables ...

  etims_submissions: {
    keyPath: 'id',
    indexes: [
      { name: 'store_id', keyPath: 'store_id' },
      { name: 'invoice_number', keyPath: 'invoice_number' },
      { name: 'synced', keyPath: 'synced' },
      { name: 'submitted_at', keyPath: 'submitted_at' }
    ]
  }
}; 