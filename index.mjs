// Import the required AWS SDK clients and commands for Node.js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

// Create a DynamoDB client
const ddb_client = new DynamoDBClient({ region: 'eu-west-2' });
const table_name = 'trainings_aggregates';

export const handler = async (event) => {
    // Parse the set of user IDs from the POST request body
    const user_ids = JSON.parse(event.body).user_ids;
    const results = {};

    // Calculate the current year and week, and the week 12 weeks ago
    const current_year_week = get_year_week_string(new Date());
    const twelve_weeks_ago_date = new Date();
    twelve_weeks_ago_date.setDate(twelve_weeks_ago_date.getDate() - 84);
    const twelve_weeks_ago_year_week = get_year_week_string(twelve_weeks_ago_date);

    for (const user_id of user_ids) {
        const user_activity_key = `${user_id}#RUNNING`;
        const params = {
            TableName: table_name,
            KeyConditionExpression: '#uact = :uact and #yweek BETWEEN :start and :end',
            ExpressionAttributeNames: {
                '#uact': 'user_id#activity_type',
                '#yweek': 'year#week'
            },
            ExpressionAttributeValues: {
                ':uact': user_activity_key,
                ':start': twelve_weeks_ago_year_week,
                ':end': current_year_week
            }
        };

        try {
            // Query DynamoDB for the given user ID
            const { Items } = await ddb_client.send(new QueryCommand(params));
            // Sum the kilometers
            const total_km = Items.reduce((acc, item) => acc + parseFloat(item.km || 0), 0);
            // Store the result
            results[user_id] = total_km;
        } catch (err) {
            console.error(`Error querying DynamoDB for user ${user_id}:`, err);
            // In case of an error or no entries, set the total_km to 0
            results[user_id] = 0;
        }
    }

    // Return the results as a JSON dictionary
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results)
    };
};

function get_year_week_string(date) {
    const year = date.getFullYear();
    const week = get_week_number(date);
    const week_string = week < 10 ? `0${week}` : `${week}`;
    return `${year}#${week_string}`;
}

function get_week_number(date) {
    date = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const year_start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week_no = Math.ceil(((date - year_start) / 86400000 + 1) / 7);
    return week_no;
}