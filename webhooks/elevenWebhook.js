const express = require('express');
const router = express.Router();

// Webhook endpoint for Eleven Labs
router.post('/webhook', (req, res) => {
    const eventType = req.body.eventType;

    switch (eventType) {
        case 'call_start':
            console.log('Call started');
            // Add your logic for when the call starts here
            break;
        case 'call_end':
            console.log('Call ended');
            // Add your logic for when the call ends here
            break;
        // Add other cases for different events as needed
        default:
            console.log('Unhandled event type:', eventType);
            break;
    }

    res.status(200).send('Event received');
});

module.exports = router;