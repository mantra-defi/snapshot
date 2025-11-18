// read user datafrom database
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import { getUserAddress, getUserAddress } from './userAddress';

async function main() {
    const address = getUserAddress("mantra19zlvygk7x5wzchchc0tlnelsjrn5etenw2ymdy");
    console.log(address);
}

main().catch(console.error);