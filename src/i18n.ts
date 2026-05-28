import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "nav": {
        "home": "Home",
        "books": "Library",
        "about": "About",
        "team": "Board of Directors",
        "constitution": "Constitution",
        "buy": "Buy Books",
        "login": "Login",
        "dashboard": "Dashboard",
        "donors": "Donors",
        "blog": "Book Review",
        "donate": "Donate"
      },
      "home": {
        "badge": "A community-driven knowledge hub",
        "heading1": "Read, Learn & Grow",
        "heading2": "Pandhoa Open Library",
        "description": "Welcome to the Pandhoa Open Library. We believe in providing accessible knowledge to everyone. Become a member today and unlock a world of books.",
        "becomeMember": "Become a Member",
        "browseBooks": "Browse Books",
        "loginPortal": "Login",
        "features": {
          "title": "Everything you need to learn",
          "subtitle": "A complete ecosystem for reading, connecting, and growing.",
          "col1Title": "Vast Collection",
          "col1Desc": "Explore hundreds of books across multiple categories. From fiction to academic texts, we have something for everyone.",
          "col2Title": "Dedicated Community",
          "col2Desc": "Join an active community of local readers. Discuss books, participate in events, and share knowledge.",
          "col3Title": "Transparent System",
          "col3Desc": "We manage our funds and donations transparently. Every contribution is recorded and visible to the public."
        },
        "testimonial": "\"Books are the magic keys that open the doors to the unknown.\"",
        "since": "Pandhoa Open Library",
        "members": "Join our active members today."
      }
    }
  },
  bn: {
    translation: {
      "nav": {
        "home": "হোম",
        "books": "বইসমূহ",
        "about": "আমাদের সম্পর্কে",
        "team": "পরিচালনা পর্ষদ",
        "constitution": "গঠনতন্ত্র",
        "buy": "বই কিনুন",
        "login": "লগইন",
        "dashboard": "ড্যাশবোর্ড",
        "donors": "দাতা সদস্য",
        "blog": "বুক রিভিও",
        "donate": "দান করুন"
      },
      "home": {
        "badge": "সবার জন্য উন্মুক্ত জ্ঞানচর্চা কেন্দ্র",
        "heading1": "বইয়ের আলোয় আলোকিত হোক প্রতিটি প্রাণ",
        "heading2": "পানধোয়া উন্মুক্ত পাঠাগার",
        "description": "পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আমরা বিশ্বাস করি জ্ঞান সবার জন্য উন্মুক্ত হওয়া উচিত। আজই আমাদের সদস্য হোন এবং শুরু করুন আপনার নতুন পাঠযাত্রা।",
        "becomeMember": "সদস্য হোন",
        "browseBooks": "বই সংগ্রহ দেখুন",
        "loginPortal": "লগইন করুন",
        "features": {
          "title": "শেখার জন্য যা কিছু প্রয়োজন",
          "subtitle": "পড়া, সংযোগ স্থাপন এবং বেড়ে ওঠার জন্য একটি সম্পূর্ণ ইকোসিস্টেম।",
          "col1Title": "বিশাল সংগ্রহ",
          "col1Desc": "একাধিক ক্যাটাগরিতে শত শত বই ঘুরে দেখুন। ফিকশন থেকে শুরু করে একাডেমিক বই, সবার জন্য কিছু না কিছু আছে।",
          "col2Title": "নিবেদিত পাঠকমহল",
          "col2Desc": "স্থানীয় পাঠকদের একটি সক্রিয় কমিউনিটিতে যোগ দিন। বই নিয়ে আলোচনা করুন, ইভেন্টগুলোতে অংশগ্রহণ করুন এবং জ্ঞান শেয়ার করুন।",
          "col3Title": "স্বচ্ছ পরিচালনা",
          "col3Desc": "আমরা আমাদের তহবিল এবং অনুদান স্বচ্ছভাবে পরিচালনা করি। প্রতিটি অবদান রেকর্ড করা হয় এবং সবার জন্য উন্মুক্ত থাকে।"
        },
        "testimonial": "\"বই হলো এমন এক জাদুর চাবি, যা অজানার দরজা খুলে দেয়।\"",
        "since": "পানধোয়া উন্মুক্ত পাঠাগার",
        "members": "আজই আমাদের সক্রিয় সদস্যের সাথে যোগ দিন।"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'bn',
    lng: 'bn',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
