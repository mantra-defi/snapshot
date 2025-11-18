import axios from 'axios';
import { closeConnection, createConnection, createOrUpdateUserAddress, getUserAddress, insertUserAddressHistory } from '../database/dbHelper';
import { config } from "dotenv";
import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';

config({ path: '../../.env' });

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

async function fetchAllStateData() {
  const baseUrl = 'https://mantra-rest.publicnode.com/cosmwasm/wasm/v1/contract';
  const contractAddress = 'mantra1jqy453tqmd8l7xtxz5cxfaw8rms7u8lsjtdd3u7hlm4gzjfy54usuunnmk';

  // Customize your headers as necessary
  const defaultHeaders = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0',  // keep or modify as needed
  };

  let allData = [];
  let nextKey = null;   // pagination key from previous response
  let pageCounter = 1;  // just to keep track of pages if you want

  do {
    try {
      const params = {
        // If you have a nextKey from the previous iteration, pass it here
        'pagination.key': nextKey,
        // Optionally, set a limit per page
        'pagination.limit': 50,
      };

      console.log(`Fetching page ${pageCounter}...`);

      const response = await axios.get(
        `${baseUrl}/${contractAddress}/state`,
        {
          headers: defaultHeaders,
          params
        }
      );

      // The API response structure may vary; adjust accordingly
      const responseData = response.data;

      // If the results are in some array, push them into allData
      // For instance, if the key is `models` in the JSON:
      if (responseData && responseData.models) {
        allData.push(...responseData.models);
      }

      // Update nextKey from the response's pagination data
      // The exact path might differ depending on the API's response format
      if (responseData.pagination && responseData.pagination.next_key) {
        nextKey = responseData.pagination.next_key;
      } else {
        nextKey = null;
      }

      pageCounter += 1;

    } catch (error) {
      console.error('Error fetching data:', error.message);
      break; // break out of the loop if there's an error
    }

  } while (nextKey);

  return allData;
}

function decodeBase64ToJson(base64String: string) {
  try {
    const decodedString = Buffer.from(base64String, 'base64').toString('utf-8');
    return JSON.parse(decodedString);
  } catch (error) {
    console.error('Error decoding base64:', error);
    return null;
  }
}

async function processBalanceData() {
  const allStateData = await fetchAllStateData();
  const balanceMap = new Map<string, any>();

  console.log('Fetched all data:', allStateData.length, 'records');

  // Filter and process only balance keys
  allStateData.forEach(item => {
    const asciiKey = Buffer.from(item.key, 'hex').toString('ascii');

    if (asciiKey.substring(2, 9) === 'balance') {
      const address = asciiKey.replace('balance', '');
      const value = decodeBase64ToJson(item.value);
      balanceMap.set(address, value);
    }
  });

  return balanceMap;
}

function sanitizeAddress(address: string): string {
  // Remove null bytes and any non-printable characters
  return address.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
}

async function pushToDb(balances: Map<string, any>) {
  try {
    await createConnection();
    const currentTimestamp = BigInt(Date.now());

    for (const [address, value] of balances) {
      try {
        // Convert value to number if it's not already
        const balanceValue = Number(value);
        const lsdMultiplier = 0.25;
        const points = Math.floor(balanceValue / (10 ** 5)) * lsdMultiplier;
        // Sanitize the address before inserting
        const sanitizedAddress = sanitizeAddress(address);

        // Insert into both tables with sanitized address
        const userAddress = await getUserAddress(sanitizedAddress);
        const userPoints = userAddress ? userAddress.points : 0;
        await createOrUpdateUserAddress(sanitizedAddress, balanceValue, currentTimestamp, points + userPoints);
        // await insertUserAddressHistory(sanitizedAddress, balanceValue, currentTimestamp, "lsd", points);

        console.log(`Stored balance for address ${sanitizedAddress}: ${balanceValue}, points: ${points}`);
      } catch (error) {
        console.error(`Error storing balance for address ${address}:`, error);
        // Continue with next balance even if one fails
        continue;
      }
    }

    console.log('Completed storing all balances');
  } catch (error) {
    console.error('Error in pushToDb:', error);
    throw error;
  } finally {
    await closeConnection();
  }
}

// Export the main function to be used by the cron job
export async function updateBalances() {
  try {
    const balances = await processBalanceData();
    await pushToDb(balances);
    console.log('Total balances:', balances.size);

    // Send success message
    await bot.sendMessage(
      CHAT_ID,
      `✅ FtOM balance update completed successfully\nTotal balances processed: ${balances.size}\nTime: ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error('Error in updateBalances:', error);

    // Send error message
    await bot.sendMessage(
      CHAT_ID,
      `❌ Error in FtOM balance update:\n${error.message}\nTime: ${new Date().toISOString()}`
    );
  }
}

// Set up cron job to run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running balance update job:', new Date().toISOString());
  await updateBalances();
});

bot.sendMessage(CHAT_ID, 'Script started!');

// Initial run when the script starts
// updateBalances();



// async function main2() {
//   await createConnection();
//     const address = await getUserAddress("mantra19zlvygk7x5wzchchc0tlnelsjrn5etenw2ymdy");
//     console.log(address);
// }

// main2().catch(console.error);