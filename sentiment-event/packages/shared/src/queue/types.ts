export interface QueueMessage<T> {
  id: string;
  payload: T;
  enqueuedAt: string;
}

export interface QueueClient<T> {
  enqueue(payload: T): Promise<QueueMessage<T>>;
  dequeueBatch(maxItems: number): Promise<QueueMessage<T>[]>;
  ack(ids: string[]): Promise<void>;
}
