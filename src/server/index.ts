import express from 'express';
import cors from 'cors';
import { createConnection, getUserAddressHistory, createOrUpdateUserAddress, getUserAddress, getAllUserAddresses, getReferralPointsByAddress, getReferralsForAddress, getTopReferrers, getReferralPointsForMultipleAddresses } from '../database/dbHelper.js';

const app = express();
const PORT = 4457;

// Configure CORS and JSON middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Initialize database connection before starting server
async function startServer() {
    try {
        await createConnection();
        console.log('Database connection established');

        // Start server only after DB connection is established
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

// API endpoint to get user address history
app.get('/api/history/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const history = await getUserAddress(address);
        
        // Get referral points for this address
        const referralPoints = await getReferralPointsByAddress(address);
        
        // Get referrals made by this address
        const referrals = await getReferralsForAddress(address);

        res.json({
            success: true,
            data: {
                userInfo: history,
                referralPoints: referralPoints,
                referrals: referrals
            },
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const userLeaderboard = await getAllUserAddresses(5000);
        
        // Get top referrers
        const referralLeaderboard = await getTopReferrers(5000);
        
        // Get referral points for users in the main leaderboard
        const addresses = userLeaderboard.map(user => user.address);
        const referralPointsForUsers = await getReferralPointsForMultipleAddresses(addresses);
        
        // Create a map for quick lookup
        const referralPointsMap = {};
        referralPointsForUsers.forEach(item => {
            referralPointsMap[item.address] = item.totalPoints;
        });
        
        // Add referral points to user data
        const enrichedUserLeaderboard = userLeaderboard.map(user => ({
            ...user,
            referralPoints: referralPointsMap[user.address] || 0
        }));
        
        res.json({
            success: true,
            data: {
                userLeaderboard: enrichedUserLeaderboard,
                referralLeaderboard: referralLeaderboard
            },
        });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// // Add a new endpoint specifically for referral data
// app.get('/api/referrals/:address', async (req, res) => {
//     try {
//         const { address } = req.params;
        
//         // Get referral points
//         const referralPoints = await getReferralPointsByAddress(address);
        
//         // Get list of referrals
//         const referrals = await getReferralsForAddress(address);
        
//         res.json({
//             success: true,
//             data: {
//                 points: referralPoints,
//                 referrals: referrals
//             },
//         });
//     } catch (error) {
//         console.error('Error fetching referral data:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//         });
//     }
// });

// Add a new endpoint for top referrers
app.get('/api/referrals/leaderboard/:limit?', async (req, res) => {
    try {
        const limit = req.params.limit ? parseInt(req.params.limit) : 50;
        const topReferrers = await getTopReferrers(limit);
        
        res.json({
            success: true,
            data: topReferrers
        });
    } catch (error) {
        console.error('Error fetching top referrers:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// Start the server
startServer();
