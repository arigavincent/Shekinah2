export const PHASE1_IMAGES = {
  devotion: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600",
  sermon: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900",
  audio: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=700",
  event: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900",
  crowd: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1200",
  branch: "https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=900",
  clip: "https://images.unsplash.com/photo-1445232867465-97891f9b5294?q=80&w=700"
};

// Phase 1 uses backend-shaped local sample content.
// Phase 2 should return this same shape from the Go API + PostgreSQL,
// so screens can migrate from local imports to API data with minimal changes.
export const DATA = {
  scripture: {
    title: "Scripture of the Day",
    verse: "The Lord is my light and my salvation; whom shall I fear?",
    reference: "Psalm 27:1"
  },

  live: {
    isLive: true,
    title: "Sunday Celebration Service",
    viewers: "1,284",
    nextService: "Sunday, 9:00 AM",
    youtubeId: "jfKfPfyJRdk"
  },

  devotions: [
    {
      id: "dev-1",
      title: "Walking In The Light Of God",
      excerpt: "A reminder to stand in faith and let the word of God shape your day.",
      date: "June 4, 2026",
      image: PHASE1_IMAGES.devotion,
      body:
        "God calls His people to walk in light, confidence, and obedience. Today, choose to let the word of God guide your thoughts, your speech, and your decisions. Faith is not passive. It is a daily walk."
    },
    {
      id: "dev-2",
      title: "Strength For The Assignment",
      excerpt: "The grace of God gives strength for every responsibility placed before you.",
      date: "June 3, 2026",
      image: "https://images.unsplash.com/photo-1475785584197-7726ac74ebf2?q=80&w=700",
      body:
        "There is an assignment attached to your life. The Lord does not only call; He equips. Lean on His grace and continue faithfully in what He has placed in your hands."
    },
    {
      id: "dev-3",
      title: "A Heart That Seeks God",
      excerpt: "A seeking heart is never empty; it is continually filled by the Spirit.",
      date: "June 2, 2026",
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=700",
      body:
        "The hunger for God is a holy invitation. Keep your heart open, your worship sincere, and your attention fixed on Him."
    }
  ],

  sermons: [
    {
      id: "ser-1",
      type: "video",
      title: "The Power Of A Consecrated Life",
      speaker: "Shekinah Sons Global",
      date: "June 2, 2026",
      category: "Faith",
      live: true,
      thumbnail: PHASE1_IMAGES.sermon,
      description:
        "A message on living set apart for God, carrying spiritual discipline into daily life, and building a consistent walk with Christ."
    },
    {
      id: "ser-2",
      type: "video",
      title: "Building Altars Of Prayer",
      speaker: "Shekinah Sons Global",
      date: "May 29, 2026",
      category: "Prayer",
      live: false,
      thumbnail: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?q=80&w=900",
      description:
        "A teaching on prayer, consistency, and creating a life that hosts the presence of God."
    },
    {
      id: "ser-3",
      type: "audio",
      title: "Grace For The New Season",
      speaker: "Shekinah Sons Global",
      date: "May 26, 2026",
      category: "Grace",
      live: false,
      thumbnail: PHASE1_IMAGES.audio,
      duration: "54:20",
      description:
        "An audio sermon on discerning seasons and moving with the wisdom of God."
    },
    {
      id: "ser-4",
      type: "audio",
      title: "The Sound Of Revival",
      speaker: "Shekinah Sons Global",
      date: "May 20, 2026",
      category: "Revival",
      live: false,
      thumbnail: "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?q=80&w=900",
      duration: "47:08",
      description:
        "A stirring message on hunger, worship, and the move of God among His people."
    }
  ],

  categories: [
    {
      id: "cat-1",
      name: "Faith",
      count: 42,
      image: PHASE1_IMAGES.sermon
    },
    {
      id: "cat-2",
      name: "Prayer",
      count: 31,
      image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=700"
    },
    {
      id: "cat-3",
      name: "Grace",
      count: 28,
      image: PHASE1_IMAGES.audio
    },
    {
      id: "cat-4",
      name: "Revival",
      count: 16,
      image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=700"
    }
  ],

  clips: [
    {
      id: "clip-1",
      title: "Faith Speaks Before It Sees",
      image: PHASE1_IMAGES.clip
    },
    {
      id: "clip-2",
      title: "Prayer Changes Atmospheres",
      image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=700"
    },
    {
      id: "clip-3",
      title: "Carry The Fire Daily",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=700"
    }
  ],

  events: [
    {
      id: "evt-1",
      title: "Night Of Worship",
      date: "June 14, 2026",
      time: "6:00 PM",
      location: "Main Sanctuary",
      image: PHASE1_IMAGES.event,
      description: "An evening of worship, prayer, and the ministry of the word."
    },
    {
      id: "evt-2",
      title: "Youth Ablaze Conference",
      date: "June 21, 2026",
      time: "10:00 AM",
      location: "Shekinah City Campus",
      image: "https://images.unsplash.com/photo-1515169067865-5387ec356754?q=80&w=900",
      description: "A youth gathering focused on purpose, purity, and spiritual fire."
    },
    {
      id: "evt-3",
      title: "Prayer And Fasting Week",
      date: "July 1, 2026",
      time: "5:30 AM",
      location: "All Branches",
      image: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=900",
      description: "A week of corporate prayer and consecration."
    }
  ],

  branches: [
    {
      id: "br-1",
      name: "Shekinah Sons Global - Main Campus",
      address: "Nairobi, Kenya",
      services: "Sunday Celebration Service: 9:00 AM · Midweek Service: Wednesday 5:30 PM",
      phone: "+254 700 000 000",
      lat: -1.286389,
      lng: 36.817223
    },
    {
      id: "br-2",
      name: "Shekinah Sons Global - City Campus",
      address: "Nairobi City Campus, Kenya",
      services: "Sunday Service: 11:30 AM · Prayer Meeting: Friday 6:00 PM",
      phone: "+254 711 000 000",
      lat: -1.2644,
      lng: 36.8028
    }
  ],

  updates: [
    {
      id: "up-1",
      title: "Midweek Service Update",
      excerpt: "Join us this Wednesday evening for worship, prayer, and the ministry of the word.",
      date: "June 4, 2026",
      image: PHASE1_IMAGES.event
    },
    {
      id: "up-2",
      title: "Prayer Points",
      excerpt: "This week we are praying for families, healing, spiritual growth, and national peace.",
      date: "June 3, 2026",
      image: PHASE1_IMAGES.devotion
    }
  ],

  platforms: {
    Web: [
      {
        id: "web-1",
        name: "Official Website",
        description: "Access sermons, church updates, giving information, and ministry resources online.",
        link: "https://example.com"
      }
    ],
    TV: [
      {
        id: "tv-1",
        name: "Shekinah TV",
        description: "Watch selected teachings, worship moments, service highlights, and ministry broadcasts."
      }
    ],
    Radio: [
      {
        id: "radio-1",
        name: "Shekinah Radio",
        description: "Listen to devotionals, prayers, and faith-building messages throughout the week."
      }
    ]
  },

  downloads: [
    {
      id: "dl-1",
      title: "Grace For The New Season",
      size: "62 MB",
      image: PHASE1_IMAGES.audio
    },
    {
      id: "dl-2",
      title: "Building Altars Of Prayer",
      size: "118 MB",
      image: PHASE1_IMAGES.sermon
    }
  ],

  prayers: [
    {
      id: "pr-1",
      name: "Anonymous",
      text: "Pray with me for healing and renewed strength.",
      date: "Today",
      count: 24
    },
    {
      id: "pr-2",
      name: "Mary",
      text: "Believing God for a new job and direction.",
      date: "Yesterday",
      count: 18
    }
  ],

  about: {
    vision:
      "To raise a generation that walks in the presence of God, lives by the word, and carries the light of Christ into families, cities, and nations.",
    description:
      "Shekinah Sons Global is a Christ-centered ministry devoted to worship, prayer, discipleship, and the teaching of God’s word. This app exists to help members and friends stay connected to sermons, devotions, live services, events, prayer, and church updates.",
    contactSummary:
      "Visit one of our branches, follow our platforms, or connect with the church through the contact details provided in the app."
  }
};