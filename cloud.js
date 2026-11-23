/*
 * ক্লাউড (Firebase) সংযোগ। এখন এটি একটি প্লেসহোল্ডার।
 * Firebase প্রজেক্ট তৈরি করে কনফিগ এখানে বসালে Authentication ও Firestore সিঙ্ক যুক্ত করা হবে।
 * তখন পর্যন্ত সব ডেটা এই ডিভাইসের লোকাল স্টোরেজে থাকবে এবং অফলাইনে পুরোপুরি কাজ করবে।
 */
const FIREBASE_CONFIG = null; // উদাহরণ: { apiKey: '...', authDomain: '...', projectId: '...' }

const CLOUD = {
  enabled: false,

  async init() {
    if (!FIREBASE_CONFIG) return false;
    // Firebase SDK লোড ও initializeApp এখানে যুক্ত হবে
    return false;
  },

  status() {
    return this.enabled ? 'synced' : 'local';
  }
};
