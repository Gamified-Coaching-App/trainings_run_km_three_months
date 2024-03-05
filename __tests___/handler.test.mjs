import { handler } from '../index.mjs'; // Ensure the import path is correct

jest.mock('@aws-sdk/client-dynamodb', () => {
  const sendMock = jest.fn(); // Define send as a mock function at the top level
  return {
    DynamoDBClient: jest.fn(() => ({
      send: sendMock
    })),
    sendMock // Expose sendMock for easy access and manipulation in tests
  };
});

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  QueryCommand: jest.fn()
}));

// Access the sendMock directly from the mocked module
const { sendMock } = require('@aws-sdk/client-dynamodb');

describe('handler function tests', () => {
  beforeEach(() => {
    sendMock.mockReset(); // Reset the mock to its default state before each test
  });

  it('successfully aggregates user kilometers', async () => {
    sendMock.mockResolvedValue({
      Items: [
        { km: '5.0' },
        { km: '7.5' }
      ]
    });

    const event = {
      body: JSON.stringify({
        user_ids: ['user1']
      })
    };

    const expectedResults = {
      user1: 12.5, // 5.0 + 7.5
    };

    const response = await handler(event);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual(expectedResults);
  });

  it('handles an empty user_ids array gracefully', async () => {
    const event = {
      body: JSON.stringify({ user_ids: [] })
    };

    const response = await handler(event);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({});
  });
  it('handles an error querying DynamoDB', async () => {
    const event = {
      body: JSON.stringify({ user_ids: ['user1'] })
    };

    // Simulate an error
    const { sendMock } = require('@aws-sdk/client-dynamodb');
    sendMock.mockImplementationOnce(() => Promise.reject(new Error('DynamoDB error')));

    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await handler(event);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({ user1: 0 });
  });
});