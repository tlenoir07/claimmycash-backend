const express = require('express');
const app = express();
const cors = require("cors");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const { db } = require('./firebase');

app.use(cors());
app.use(express.json());

// 🔍 Email Unlock Endpoint
app.post("/check-email", async (req, res) => {
  const { email } = req.body;
  try {
    const doc = await db.collection("paid_users").doc(email).get();  // ✅ matches webhook save
    if (doc.exists) {
      return res.json({ paid: true });
    }
    return res.json({ paid: false });
  } catch (err) {
    console.error("Error checking email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🧾 Stripe Webhook (must come AFTER raw body parsing!)
app.use(bodyParser.raw({ type: 'application/json' }));
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customer_email = session.customer_details.email;

    try {
      await db.collection('paid_users').doc(customer_email).set({
        email: customer_email,
        timestamp: new Date()
      });
      console.log(`✔️ Added ${customer_email} to paid_users`);
    } catch (err) {
      console.error("❌ Firestore error:", err);
    }
  }

  res.status(200).json({ received: true });
});

// 🧪 Health check
app.get('/', (req, res) => {
  res.send("ClaimMyCash Webhook Running.");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
