import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView, useMotionValueEvent } from 'motion/react';
import { Menu, X, MapPin, Phone, Mail, Clock, ChefHat, Award, Star, Heart, Leaf, Flame, Globe, Users, Calendar, Wine, TrendingUp, BookOpen, Utensils } from 'lucide-react';
import { EyeOfHorus, AnkhSymbol, LotusFlower, Scarab, PapyrusBorder, HieroglyphicDivider, EgyptianColumn, Cartouche, SunDisk, PyramidPattern } from './components/EgyptianDecorations';

type Language = 'en' | 'ar';

interface Translation {
  nav: {
    about: string;
    menu: string;
    chef: string;
    experience: string;
    events: string;
    gallery: string;
    contact: string;
    reserve: string;
  };
  hero: {
    since: string;
    title: string;
    subtitle: string;
    exploreMenu: string;
    reserveTable: string;
    scroll: string;
  };
  stats: {
    yearsOfTradition: string;
    masterChefs: string;
    happyGuests: string;
    awardsWon: string;
  };
  about: {
    badge: string;
    title: string;
    paragraph1: string;
    paragraph2: string;
    paragraph3: string;
  };
  menu: {
    badge: string;
    title: string;
    subtitle: string;
    traditionalMains: string;
    vegetarianDelights: string;
    appetizers: string;
    desserts: string;
    beverages: string;
    viewFullMenu: string;
    koshari: string;
    koshariDesc: string;
    mixedGrill: string;
    mixedGrillDesc: string;
    falafel: string;
    falafelDesc: string;
    mahshi: string;
    mahshiDesc: string;
    fattah: string;
    fattahDesc: string;
    molokhia: string;
    molokhiaDesc: string;
    mezze: string;
    mezzeDesc: string;
    sambousek: string;
    sambousekDesc: string;
    basbousa: string;
    basbousaDesc: string;
    konafa: string;
    konafaDesc: string;
    egyptianTea: string;
    egyptianTeaDesc: string;
    freshJuice: string;
    freshJuiceDesc: string;
  };
  chef: {
    badge: string;
    title: string;
    subtitle: string;
    name: string;
    bio1: string;
    bio2: string;
    bio3: string;
    yearsExperience: string;
    awards: string;
    specialty: string;
    specialtyText: string;
  };
  awards: {
    badge: string;
    title: string;
    subtitle: string;
    award1: string;
    award1Desc: string;
    award2: string;
    award2Desc: string;
    award3: string;
    award3Desc: string;
    award4: string;
    award4Desc: string;
  };
  privateDining: {
    badge: string;
    title: string;
    subtitle: string;
    feature1: string;
    feature1Desc: string;
    feature2: string;
    feature2Desc: string;
    feature3: string;
    feature3Desc: string;
    inquire: string;
  };
  heritage: {
    badge: string;
    title: string;
    year1952: string;
    year1952Desc: string;
    year1975: string;
    year1975Desc: string;
    year1998: string;
    year1998Desc: string;
    year2020: string;
    year2020Desc: string;
  };
  experience: {
    badge: string;
    title: string;
    subtitle: string;
    authenticAmbiance: string;
    freshIngredients: string;
    culinaryArtistry: string;
  };
  specialties: {
    madeWithLove: string;
    madeWithLoveDesc: string;
    freshAuthentic: string;
    freshAuthenticDesc: string;
    traditionalMethods: string;
    traditionalMethodsDesc: string;
  };
  testimonials: {
    badge: string;
    title: string;
    testimonial1: string;
    author1: string;
    location1: string;
    testimonial2: string;
    author2: string;
    location2: string;
    testimonial3: string;
    author3: string;
    location3: string;
  };
  gallery: {
    badge: string;
    title: string;
  };
  contact: {
    badge: string;
    title: string;
    subtitle: string;
    location: string;
    locationAddress: string;
    openingHours: string;
    hours: string;
    phone: string;
    email: string;
    makeReservation: string;
    footer1: string;
    footer2: string;
  };
}

const translations: Record<Language, Translation> = {
  en: {
    nav: {
      about: 'About',
      menu: 'Menu',
      chef: 'Chef',
      experience: 'Experience',
      events: 'Events',
      gallery: 'Gallery',
      contact: 'Contact',
      reserve: 'Reserve'
    },
    hero: {
      since: 'Since 1952',
      title: 'Nile Heritage',
      subtitle: 'Authentic Egyptian Cuisine Passed Down Through Generations',
      exploreMenu: 'Explore Menu',
      reserveTable: 'Reserve Table',
      scroll: 'Scroll'
    },
    stats: {
      yearsOfTradition: 'Years of Tradition',
      masterChefs: 'Master Chefs',
      happyGuests: 'Happy Guests',
      awardsWon: 'Awards Won'
    },
    about: {
      badge: 'Our Story',
      title: 'A Journey Through Time',
      paragraph1: 'Since 1952, Nile Heritage has been the cornerstone of authentic Egyptian cuisine, bringing centuries-old family recipes from the heart of Cairo to discerning diners around the world.',
      paragraph2: 'Founded by Master Chef Ahmed Hassan, our restaurant embodies the spirit of traditional Egyptian hospitality. Every dish tells a story—of ancient spice routes, bustling souks, and family gatherings along the Nile.',
      paragraph3: 'We source our ingredients from trusted artisans and local markets, ensuring that each meal honors the authenticity and depth of Egyptian culinary heritage.'
    },
    menu: {
      badge: 'Curated Menu',
      title: 'Signature Dishes',
      subtitle: 'Every recipe passed down through generations, perfected over decades',
      traditionalMains: 'Traditional Mains',
      vegetarianDelights: 'Vegetarian Delights',
      appetizers: 'Appetizers & Mezze',
      desserts: 'Traditional Desserts',
      beverages: 'Beverages',
      viewFullMenu: 'View Full Menu',
      koshari: 'Koshari',
      koshariDesc: 'Egypt\'s national treasure - harmonious layers of rice, lentils, macaroni, and chickpeas crowned with spicy tomato sauce',
      mixedGrill: 'Mixed Grill Platter',
      mixedGrillDesc: 'Kofta, shish tawook, and lamb kebab grilled over open flame, served with warm pita and tahini',
      falafel: 'Falafel & Mezze',
      falafelDesc: 'Crispy falafel crafted from fava beans and herbs, accompanied by hummus, baba ganoush, and fresh tabbouleh',
      mahshi: 'Mahshi Selection',
      mahshiDesc: 'Vine leaves, zucchini, and bell peppers stuffed with herbed rice, slow-cooked in tomato broth',
      fattah: 'Fattah',
      fattahDesc: 'Celebratory dish of crispy bread layered with fragrant rice, tender lamb, and garlic-infused yogurt sauce',
      molokhia: 'Molokhia',
      molokhiaDesc: 'Traditional Egyptian jute leaf stew with garlic, coriander, slow-cooked with chicken or rabbit',
      mezze: 'Royal Mezze Platter',
      mezzeDesc: 'Curated selection of hummus, baba ganoush, muhammara, labneh, and marinated olives with warm pita',
      sambousek: 'Sambousek',
      sambousekDesc: 'Golden pastry triangles filled with spiced meat or cheese, served with tahini dipping sauce',
      basbousa: 'Basbousa',
      basbousaDesc: 'Sweet semolina cake soaked in orange blossom syrup, topped with almonds and coconut',
      konafa: 'Konafa',
      konafaDesc: 'Delicate shredded phyllo dough filled with sweet cheese or nuts, baked until golden',
      egyptianTea: 'Egyptian Mint Tea',
      egyptianTeaDesc: 'Traditional black tea infused with fresh mint leaves and sweetened to perfection',
      freshJuice: 'Freshly Squeezed Juice',
      freshJuiceDesc: 'Daily selection of seasonal Egyptian fruits: mango, guava, sugarcane, and tamarind'
    },
    chef: {
      badge: 'Master Chef',
      title: 'Chef Karim Hassan',
      subtitle: 'Third generation guardian of Egyptian culinary traditions',
      name: 'Chef Karim Hassan',
      bio1: 'Born into a family of celebrated Egyptian chefs, Karim Hassan has dedicated his life to preserving and elevating the authentic flavors of Egypt. Training under his grandfather, Master Chef Ahmed Hassan, he learned the sacred recipes and techniques passed down through three generations.',
      bio2: 'After perfecting his craft in Cairo\'s most prestigious kitchens and studying at Le Cordon Bleu, Chef Karim returned to his roots, determined to share Egypt\'s rich culinary heritage with the world. His innovative approach honors tradition while embracing modern culinary excellence.',
      bio3: 'Under his leadership, Nile Heritage has earned international acclaim, receiving numerous awards and recognition from culinary institutions worldwide. Chef Karim believes that food is more than sustenance—it is a bridge between cultures, a celebration of history, and an expression of love.',
      yearsExperience: 'Years of Culinary Excellence',
      awards: 'International Awards',
      specialty: 'Philosophy',
      specialtyText: '"Every dish must tell a story of Egypt—from the sun-kissed fields of the Nile Delta to the aromatic souks of Old Cairo. I cook not just to feed, but to transport our guests to the heart of Egyptian culture."'
    },
    awards: {
      badge: 'Recognition',
      title: 'Awards & Honors',
      subtitle: 'Celebrating excellence in authentic Egyptian cuisine',
      award1: 'Middle East\'s Best Traditional Restaurant 2025',
      award1Desc: 'Awarded by the International Culinary Excellence Foundation',
      award2: 'Heritage Cuisine Preservation Award',
      award2Desc: 'UNESCO Cultural Heritage & Gastronomy Recognition',
      award3: 'Chef of the Year - Egyptian Cuisine',
      award3Desc: 'Global Restaurant & Hotel Awards 2024',
      award4: 'Certificate of Excellence',
      award4Desc: 'Consistent 5-star ratings for authentic dining experience'
    },
    privateDining: {
      badge: 'Exclusive Events',
      title: 'Private Dining & Events',
      subtitle: 'Create unforgettable memories in our exclusive spaces',
      feature1: 'Private Dining Room',
      feature1Desc: 'Intimate setting for 12-20 guests with personalized menu curation and dedicated service',
      feature2: 'Cultural Events',
      feature2Desc: 'Traditional Egyptian celebrations, cooking classes, and cultural immersion experiences',
      feature3: 'Corporate Events',
      feature3Desc: 'Professional catering and event planning for business gatherings and special occasions',
      inquire: 'Inquire About Events'
    },
    heritage: {
      badge: 'Our Journey',
      title: 'Seven Decades of Excellence',
      year1952: '1952 - The Beginning',
      year1952Desc: 'Master Chef Ahmed Hassan opens the first Nile Heritage in Cairo, bringing authentic home-cooked Egyptian flavors to the public',
      year1975: '1975 - Expansion',
      year1975Desc: 'Second location opens in Alexandria, establishing Nile Heritage as Egypt\'s premier destination for traditional cuisine',
      year1998: '1998 - New Generation',
      year1998Desc: 'Karim Hassan joins the family business, training under his grandfather to preserve ancestral recipes and techniques',
      year2020: '2020 - International Recognition',
      year2020Desc: 'Nile Heritage receives UNESCO recognition for preserving Egyptian culinary heritage and traditional cooking methods'
    },
    experience: {
      badge: 'Ambiance',
      title: 'The Experience',
      subtitle: 'Immerse yourself in the warmth and elegance of Egyptian hospitality',
      authenticAmbiance: 'Authentic Ambiance',
      freshIngredients: 'Fresh Ingredients',
      culinaryArtistry: 'Culinary Artistry'
    },
    specialties: {
      madeWithLove: 'Made with Love',
      madeWithLoveDesc: 'Every dish crafted with care and passion, following recipes perfected over generations',
      freshAuthentic: 'Fresh & Authentic',
      freshAuthenticDesc: 'Ingredients sourced daily from local markets and trusted suppliers for peak freshness',
      traditionalMethods: 'Traditional Methods',
      traditionalMethodsDesc: 'Time-honored cooking techniques that bring out the true essence of Egyptian flavors'
    },
    testimonials: {
      badge: 'Testimonials',
      title: 'What Our Guests Say',
      testimonial1: 'The most authentic Egyptian food I\'ve had outside of Cairo. Every bite transports me back home.',
      author1: 'Fatima A.',
      location1: 'Cairo, Egypt',
      testimonial2: 'Absolutely exceptional! The koshari is divine and the atmosphere is both elegant and welcoming.',
      author2: 'Michael R.',
      location2: 'London, UK',
      testimonial3: 'A hidden gem that deserves all the recognition. The passion in every dish is evident!',
      author3: 'Sarah L.',
      location3: 'New York, USA'
    },
    gallery: {
      badge: 'Visual Journey',
      title: 'Gallery'
    },
    contact: {
      badge: 'Get In Touch',
      title: 'Visit Us',
      subtitle: 'Experience the warmth of Egyptian hospitality',
      location: 'Location',
      locationAddress: '123 Nile Street\nHeritage District\nCairo, Egypt',
      openingHours: 'Opening Hours',
      hours: 'Monday - Friday: 11:00 AM - 11:00 PM\nSaturday - Sunday: 10:00 AM - 12:00 AM',
      phone: 'Phone',
      email: 'Email',
      makeReservation: 'Make a Reservation',
      footer1: '© 2026 Nile Heritage. Preserving Egyptian culinary traditions since 1952.',
      footer2: 'Crafted with passion and dedication to authentic Egyptian cuisine'
    }
  },
  ar: {
    nav: {
      about: 'عن المطعم',
      menu: 'القائمة',
      chef: 'الشيف',
      experience: 'التجربة',
      events: 'المناسبات',
      gallery: 'المعرض',
      contact: 'اتصل بنا',
      reserve: 'احجز'
    },
    hero: {
      since: 'منذ ١٩٥٢',
      title: 'تراث النيل',
      subtitle: 'المطبخ المصري الأصيل يتوارث عبر الأجيال',
      exploreMenu: 'استكشف القائمة',
      reserveTable: 'احجز طاولة',
      scroll: 'مرر'
    },
    stats: {
      yearsOfTradition: 'سنة من التراث',
      masterChefs: 'طاهٍ محترف',
      happyGuests: 'ضيف سعيد',
      awardsWon: 'جائزة'
    },
    about: {
      badge: 'قصتنا',
      title: 'رحلة عبر الزمن',
      paragraph1: 'منذ عام ١٩٥٢، كان تراث النيل حجر الزاوية في المطبخ المصري الأصيل، حيث نقدم وصفات عائلية عمرها قرون من قلب القاهرة إلى الضيوف الكرام في جميع أنحاء العالم.',
      paragraph2: 'تأسس مطعمنا على يد الشيف الرئيسي أحمد حسن، ويجسد روح الضيافة المصرية التقليدية. كل طبق يحكي قصة - عن طرق التوابل القديمة، والأسواق المزدحمة، والتجمعات العائلية على ضفاف النيل.',
      paragraph3: 'نحصل على مكوناتنا من حرفيين موثوقين وأسواق محلية، لضمان أن كل وجبة تحترم أصالة وعمق التراث الطهوي المصري.'
    },
    menu: {
      badge: 'قائمة مختارة',
      title: 'الأطباق المميزة',
      subtitle: 'كل وصفة تم توارثها عبر الأجيال وإتقانها على مدى عقود',
      traditionalMains: 'الأطباق الرئيسية التقليدية',
      vegetarianDelights: 'الأطباق النباتية',
      appetizers: 'المقبلات والمازة',
      desserts: 'الحلويات التقليدية',
      beverages: 'المشروبات',
      viewFullMenu: 'عرض القائمة الكاملة',
      koshari: 'كشري',
      koshariDesc: 'كنز مصر الوطني - طبقات متناغمة من الأرز والعدس والمكرونة والحمص مع صلصة الطماطم الحارة',
      mixedGrill: 'طبق المشاوي المشكلة',
      mixedGrillDesc: 'كفتة وشيش طاووق وكباب لحم ضأن مشوي على نار مفتوحة، يقدم مع خبز البيتا الدافئ والطحينة',
      falafel: 'فلافل ومقبلات',
      falafelDesc: 'فلافل مقرمشة من الفول والأعشاب، مع الحمص وبابا غنوج والتبولة الطازجة',
      mahshi: 'تشكيلة محشي',
      mahshiDesc: 'ورق عنب وكوسة وفلفل محشي بالأرز المعطر، مطبوخ ببطء في مرق الطماطم',
      fattah: 'فتة',
      fattahDesc: 'طبق احتفالي من الخبز المقرمش مع الأرز المعطر واللحم الطري وصلصة الزبادي بالثوم',
      molokhia: 'ملوخية',
      molokhiaDesc: 'يخنة الملوخية المصرية التقليدية بالثوم والكزبرة، مطبوخة ببطء مع الدجاج أو الأرانب',
      mezze: 'طبق المازة الملكي',
      mezzeDesc: 'تشكيلة منتقاة من الحمص وبابا غنوج ومحمرة ولبنة وزيتون متبل مع خبز البيتا الدافئ',
      sambousek: 'سمبوسك',
      sambousekDesc: 'مثلثات معجنات ذهبية محشوة باللحم المتبل أو الجبن، تقدم مع صلصة الطحينة',
      basbousa: 'بسبوسة',
      basbousaDesc: 'كيك السميد الحلو المنقوع بشراب ماء الزهر، مزين باللوز وجوز الهند',
      konafa: 'كنافة',
      konafaDesc: 'عجينة الفيلو المبشورة الرقيقة محشوة بالجبن الحلو أو المكسرات، مخبوزة حتى تصبح ذهبية',
      egyptianTea: 'شاي مصري بالنعناع',
      egyptianTeaDesc: 'شاي أسود تقليدي منقوع بأوراق النعناع الطازجة ومحلى بشكل مثالي',
      freshJuice: 'عصير طازج',
      freshJuiceDesc: 'تشكيلة يومية من الفواكه المصرية الموسمية: المانجو والجوافة وقصب السكر والتمر الهندي'
    },
    chef: {
      badge: 'الشيف الرئيسي',
      title: 'الشيف كريم حسن',
      subtitle: 'حارس الجيل الثالث للتقاليد الطهوية المصرية',
      name: 'الشيف كريم حسن',
      bio1: 'ولد في عائلة من الطهاة المصريين المشهورين، وقد كرس كريم حسن حياته للحفاظ على النكهات الأصيلة لمصر وتطويرها. تدرب تحت إشراف جده، الشيف الرئيسي أحمد حسن، وتعلم الوصفات والتقنيات المقدسة الموروثة عبر ثلاثة أجيال.',
      bio2: 'بعد إتقان حرفته في أرقى مطابخ القاهرة ودراسته في لو كوردون بلو، عاد الشيف كريم إلى جذوره، مصممًا على مشاركة التراث الطهوي الغني لمصر مع العالم. نهجه المبتكر يحترم التقاليد مع احتضان التميز الطهوي الحديث.',
      bio3: 'تحت قيادته، حصل تراث النيل على إشادة دولية، وحصل على العديد من الجوائز والاعتراف من المؤسسات الطهوية في جميع أنحاء العالم. يؤمن الشيف كريم أن الطعام أكثر من مجرد قوت - إنه جسر بين الثقافات، واحتفال بالتاريخ، وتعبير عن الحب.',
      yearsExperience: 'سنة من التميز في الطهي',
      awards: 'جائزة دولية',
      specialty: 'الفلسفة',
      specialtyText: '"يجب أن يحكي كل طبق قصة مصر - من الحقول المشمسة لدلتا النيل إلى الأسواق العطرية في القاهرة القديمة. أطبخ ليس فقط لأطعم، ولكن لأنقل ضيوفنا إلى قلب الثقافة المصرية."'
    },
    awards: {
      badge: 'التقدير',
      title: 'الجوائز والتكريمات',
      subtitle: 'احتفالًا بالتميز في المطبخ المصري الأصيل',
      award1: 'أفضل مطعم تقليدي في الشرق الأوسط ٢٠٢٥',
      award1Desc: 'جائزة من مؤسسة التميز الطهوي الدولية',
      award2: 'جائزة الحفاظ على المطبخ التراثي',
      award2Desc: 'اعتراف اليونسكو بالتراث الثقافي وفن الطهي',
      award3: 'طاهي العام - المطبخ المصري',
      award3Desc: 'جوائز المطاعم والفنادق العالمية ٢٠٢٤',
      award4: 'شهادة التميز',
      award4Desc: 'تقييمات ٥ نجوم ثابتة لتجربة تناول طعام أصيلة'
    },
    privateDining: {
      badge: 'فعاليات حصرية',
      title: 'تناول الطعام الخاص والفعاليات',
      subtitle: 'اصنع ذكريات لا تُنسى في أماكننا الحصرية',
      feature1: 'غرفة طعام خاصة',
      feature1Desc: 'بيئة حميمة لـ ١٢-٢٠ ضيف مع قائمة مخصصة وخدمة مخصصة',
      feature2: 'فعاليات ثقافية',
      feature2Desc: 'احتفالات مصرية تقليدية، دروس طبخ، وتجارب انغماس ثقافي',
      feature3: 'فعاليات الشركات',
      feature3Desc: 'خدمات تقديم طعام محترفة وتخطيط للمناسبات للتجمعات التجارية والمناسبات الخاصة',
      inquire: 'استفسر عن الفعاليات'
    },
    heritage: {
      badge: 'رحلتنا',
      title: 'سبعة عقود من التميز',
      year1952: '١٩٥٢ - البداية',
      year1952Desc: 'الشيف الرئيسي أحمد حسن يفتتح أول تراث النيل في القاهرة، يقدم نكهات الطبخ المصري الأصيل المنزلي للجمهور',
      year1975: '١٩٧٥ - التوسع',
      year1975Desc: 'افتتاح الفرع الثاني في الإسكندرية، مما يرسخ تراث النيل كوجهة رئيسية للمطبخ التقليدي في مصر',
      year1998: '١٩٩٨ - الجيل الجديد',
      year1998Desc: 'ينضم كريم حسن إلى العمل العائلي، يتدرب تحت إشراف جده للحفاظ على الوصفات والتقنيات الموروثة',
      year2020: '٢٠٢٠ - اعتراف دولي',
      year2020Desc: 'يحصل تراث النيل على اعتراف اليونسكو للحفاظ على التراث الطهوي المصري وطرق الطبخ التقليدية'
    },
    experience: {
      badge: 'الأجواء',
      title: 'التجربة',
      subtitle: 'انغمس في دفء وأناقة الضيافة المصرية',
      authenticAmbiance: 'أجواء أصيلة',
      freshIngredients: 'مكونات طازجة',
      culinaryArtistry: 'فن الطهي'
    },
    specialties: {
      madeWithLove: 'صنع بحب',
      madeWithLoveDesc: 'كل طبق يُصنع بعناية وشغف، باتباع وصفات أُتقنت عبر الأجيال',
      freshAuthentic: 'طازج وأصيل',
      freshAuthenticDesc: 'مكونات يتم الحصول عليها يوميًا من الأسواق المحلية والموردين الموثوقين',
      traditionalMethods: 'طرق تقليدية',
      traditionalMethodsDesc: 'تقنيات طهي عريقة تُبرز الجوهر الحقيقي للنكهات المصرية'
    },
    testimonials: {
      badge: 'شهادات العملاء',
      title: 'ماذا يقول ضيوفنا',
      testimonial1: 'أكثر طعام مصري أصيل تذوقته خارج القاهرة. كل لقمة تنقلني إلى الوطن.',
      author1: 'فاطمة أ.',
      location1: 'القاهرة، مصر',
      testimonial2: 'استثنائي تمامًا! الكشري رائع والأجواء أنيقة ومرحبة في نفس الوقت.',
      author2: 'مايكل ر.',
      location2: 'لندن، المملكة المتحدة',
      testimonial3: 'جوهرة مخفية تستحق كل التقدير. الشغف واضح في كل طبق!',
      author3: 'سارة ل.',
      location3: 'نيويورك، الولايات المتحدة'
    },
    gallery: {
      badge: 'رحلة بصرية',
      title: 'المعرض'
    },
    contact: {
      badge: 'تواصل معنا',
      title: 'زرنا',
      subtitle: 'اختبر دفء الضيافة المصرية',
      location: 'الموقع',
      locationAddress: 'شارع النيل ١٢٣\nحي التراث\nالقاهرة، مصر',
      openingHours: 'ساعات العمل',
      hours: 'الإثنين - الجمعة: ١١:٠٠ ص - ١١:٠٠ م\nالسبت - الأحد: ١٠:٠٠ ص - ١٢:٠٠ ص',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      makeReservation: 'احجز طاولة',
      footer1: '© ٢٠٢٦ تراث النيل. نحافظ على تقاليد الطهي المصرية منذ ١٩٥٢.',
      footer2: 'مصنوع بشغف وتفانٍ للمطبخ المصري الأصيل'
    }
  }
};

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navBg, setNavBg] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const { scrollY } = useScroll();

  const t = translations[language];
  const isRTL = language === 'ar';

  useMotionValueEvent(scrollY, "change", (latest) => {
    setNavBg(latest > 100);
  });

  const smoothScroll = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sticky Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300"
        style={{
          backgroundColor: navBg ? 'rgba(15, 12, 9, 0.95)' : 'rgba(15, 12, 9, 0)',
          backdropFilter: navBg ? 'blur(12px)' : 'blur(0px)',
          borderColor: navBg ? 'rgba(201, 169, 97, 0.2)' : 'rgba(201, 169, 97, 0.1)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <motion.div
            className="text-xl sm:text-2xl font-bold text-primary cursor-pointer"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            whileHover={{ scale: 1.05 }}
          >
            {t.hero.title}
          </motion.div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex gap-6 items-center">
            {[
              { key: 'about', label: t.nav.about },
              { key: 'menu', label: t.nav.menu },
              { key: 'chef', label: t.nav.chef },
              { key: 'events', label: t.nav.events },
              { key: 'gallery', label: t.nav.gallery },
              { key: 'contact', label: t.nav.contact }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => smoothScroll(item.key)}
                className="text-sm uppercase tracking-wider text-secondary hover:text-primary transition-colors duration-300"
                style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors duration-300"
              title={language === 'en' ? 'العربية' : 'English'}
            >
              <Globe size={18} />
              <span>{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
            <button
              onClick={() => smoothScroll('contact')}
              className="bg-primary text-background px-6 py-2 text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            >
              {t.nav.reserve}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            className="lg:hidden bg-card/95 backdrop-blur-md border-t border-border px-4 sm:px-6 py-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {[
              { key: 'about', label: t.nav.about },
              { key: 'menu', label: t.nav.menu },
              { key: 'chef', label: t.nav.chef },
              { key: 'events', label: t.nav.events },
              { key: 'gallery', label: t.nav.gallery },
              { key: 'contact', label: t.nav.contact }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => smoothScroll(item.key)}
                className="block w-full text-left py-3 text-sm uppercase tracking-wider text-secondary hover:text-primary transition-colors"
                style={{
                  fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  textAlign: isRTL ? 'right' : 'left'
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={toggleLanguage}
              className="w-full flex items-center gap-2 py-3 text-sm text-secondary hover:text-primary transition-colors"
              style={{ justifyContent: isRTL ? 'flex-end' : 'flex-start' }}
            >
              <Globe size={18} />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <button
              onClick={() => smoothScroll('contact')}
              className="w-full mt-4 bg-primary text-background px-6 py-3 text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            >
              {t.nav.reserve}
            </button>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero Section */}
      <HeroSection t={t} isRTL={isRTL} smoothScroll={smoothScroll} />

      {/* Decorative Divider */}
      <HieroglyphicDivider className="py-12" />

      {/* Stats Section */}
      <StatsSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* About Section */}
      <AboutSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Menu Section */}
      <MenuSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Chef Section */}
      <ChefSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Experience Section */}
      <ExperienceSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Awards Section */}
      <AwardsSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Heritage Timeline */}
      <HeritageSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Private Dining */}
      <PrivateDiningSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Specialties Section */}
      <SpecialtiesSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Testimonials */}
      <TestimonialsSection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Gallery */}
      <GallerySection t={t} isRTL={isRTL} />

      <HieroglyphicDivider className="py-16" />

      {/* Contact Section */}
      <ContactSection t={t} isRTL={isRTL} />
    </div>
  );
}

function HeroSection({ t, isRTL, smoothScroll }: { t: Translation; isRTL: boolean; smoothScroll: (id: string) => void }) {
  const { scrollY } = useScroll();

  const bgY = useTransform(scrollY, [0, 1000], [0, 300]);
  const contentOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const contentY = useTransform(scrollY, [0, 500], [0, 200]);

  return (
    <section className="relative h-screen min-h-[700px] overflow-hidden">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      {/* Background with Parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ y: bgY }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(15, 12, 9, 0.4), rgba(15, 12, 9, 0.7)), url('https://images.unsplash.com/photo-1758546705512-2071bf8dc17e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1920')`
          }}
        />
        {/* Pyramid Pattern Overlay */}
        <PyramidPattern />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-10 h-full flex items-center justify-center"
        style={{ opacity: contentOpacity, y: contentY }}
      >
        <div className="text-center px-4 sm:px-6 max-w-5xl">
          {/* Sun Disk */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0 }}
            className="mb-8 flex justify-center"
          >
            <SunDisk className="w-20 h-20 text-primary" />
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-4 text-primary mb-6">
              <EyeOfHorus className="w-8 h-8" />
              <div className="h-px w-12 bg-primary" />
              <span className="text-sm uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {t.hero.since}
              </span>
              <div className="h-px w-12 bg-primary" />
              <EyeOfHorus className="w-8 h-8" />
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <Cartouche className="text-primary">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                {t.hero.title}
              </h1>
            </Cartouche>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-xl sm:text-2xl md:text-3xl text-secondary mb-12 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
          >
            {t.hero.subtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
          >
            <motion.button
              onClick={() => smoothScroll('menu')}
              className="bg-primary text-background px-10 sm:px-12 py-4 text-sm sm:text-base uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300 shadow-xl w-full sm:w-auto"
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t.hero.exploreMenu}
            </motion.button>
            <motion.button
              onClick={() => smoothScroll('contact')}
              className="border-2 border-primary text-primary px-10 sm:px-12 py-4 text-sm sm:text-base uppercase tracking-wider hover:bg-primary hover:text-background transition-all duration-300 w-full sm:w-auto"
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t.hero.reserveTable}
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        style={{ opacity: contentOpacity }}
      >
        <div className="flex flex-col items-center gap-2 text-primary">
          <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.hero.scroll}
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-px h-12 bg-primary" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function StatsSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const statIcons = [
    { Component: AnkhSymbol, value: '70+', label: t.stats.yearsOfTradition },
    { Component: LotusFlower, value: '15', label: t.stats.masterChefs },
    { Component: EyeOfHorus, value: '50K+', label: t.stats.happyGuests },
    { Component: Scarab, value: '25+', label: t.stats.awardsWon }
  ];

  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-card border-y border-border/30">
      {/* Papyrus Borders */}
      <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
      <PapyrusBorder className="absolute bottom-0 left-0 right-0 text-primary rotate-180" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {statIcons.map((stat, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="flex justify-center mb-4">
                <stat.Component className="w-12 h-12 sm:w-14 sm:h-14 text-primary" />
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm uppercase tracking-wider text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.3]);

  return (
    <section id="about" ref={ref} className="relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 overflow-hidden bg-background">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      <motion.div
        className="absolute inset-0 opacity-10"
        style={{ y }}
      >
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1590237581598-988d27565521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1920')`
          }}
        />
      </motion.div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div style={{ opacity }}>
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8 }}
              className="mb-6"
            >
              <div className="inline-flex items-center gap-3 text-primary mb-4">
                <LotusFlower className="w-6 h-6" />
                <div className="h-px w-8 bg-primary" />
                <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {t.about.badge}
                </span>
                <div className="h-px w-8 bg-primary" />
                <LotusFlower className="w-6 h-6" />
              </div>
            </motion.div>

            <motion.h2
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6 lg:mb-8"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.1 }}
              style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
            >
              {t.about.title}
            </motion.h2>

            <motion.p
              className="text-base sm:text-lg text-secondary leading-relaxed mb-6"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            >
              {t.about.paragraph1}
            </motion.p>

            <motion.p
              className="text-base sm:text-lg text-secondary leading-relaxed mb-6"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            >
              {t.about.paragraph2}
            </motion.p>

            <motion.p
              className="text-base sm:text-lg text-secondary leading-relaxed mb-8"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            >
              {t.about.paragraph3}
            </motion.p>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="relative h-[400px] sm:h-[500px] lg:h-[600px]">
              <div className={`absolute inset-0 border-4 border-primary/20 ${isRTL ? '-translate-x-4' : 'translate-x-4'} translate-y-4`} />
              <img
                src="https://images.unsplash.com/photo-1762882807447-3534bff2c831?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080"
                alt="Traditional Egyptian market"
                className="relative z-10 w-full h-full object-cover shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MenuSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const categories = [
    {
      title: t.menu.traditionalMains,
      dishes: [
        {
          name: t.menu.koshari,
          description: t.menu.koshariDesc,
          price: '$18',
          image: 'https://images.unsplash.com/photo-1775181180462-18b20da9340e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.mixedGrill,
          description: t.menu.mixedGrillDesc,
          price: '$42',
          image: 'https://images.unsplash.com/photo-1736928634472-abd43ed645a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.fattah,
          description: t.menu.fattahDesc,
          price: '$32',
          image: 'https://images.unsplash.com/photo-1628606336803-77914bbe8225?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.molokhia,
          description: t.menu.molokhiaDesc,
          price: '$28',
          image: 'https://images.unsplash.com/photo-1628606338096-686cf7dba76a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        }
      ]
    },
    {
      title: t.menu.vegetarianDelights,
      dishes: [
        {
          name: t.menu.falafel,
          description: t.menu.falafelDesc,
          price: '$22',
          image: 'https://images.unsplash.com/photo-1768812910769-d037b90aee77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.mahshi,
          description: t.menu.mahshiDesc,
          price: '$26',
          image: 'https://images.unsplash.com/photo-1653983194833-7a10838b12f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        }
      ]
    },
    {
      title: t.menu.appetizers,
      dishes: [
        {
          name: t.menu.mezze,
          description: t.menu.mezzeDesc,
          price: '$24',
          image: 'https://images.unsplash.com/photo-1775181934230-a5b02e6fa1b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.sambousek,
          description: t.menu.sambousekDesc,
          price: '$16',
          image: 'https://images.unsplash.com/photo-1701688596783-231b3764ef67?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        }
      ]
    },
    {
      title: t.menu.desserts,
      dishes: [
        {
          name: t.menu.basbousa,
          description: t.menu.basbousaDesc,
          price: '$12',
          image: 'https://images.unsplash.com/photo-1736928633626-5c35e5677874?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        },
        {
          name: t.menu.konafa,
          description: t.menu.konafaDesc,
          price: '$14',
          image: 'https://images.unsplash.com/photo-1775181237368-7c0c587b6583?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
        }
      ]
    }
  ];

  return (
    <section id="menu" className="relative py-24 sm:py-32 px-4 sm:px-6 bg-card">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      {/* Pyramid Pattern Background */}
      <PyramidPattern />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-6">
            <Scarab className="w-8 h-8" />
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.menu.badge}
            </span>
            <div className="h-px w-8 bg-primary" />
            <Scarab className="w-8 h-8" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.menu.title}
          </h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.menu.subtitle}
          </p>
        </motion.div>

        <div className="space-y-20">
          {categories.map((category, categoryIndex) => (
            <div key={category.title}>
              <motion.div
                className="flex items-center justify-center gap-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="h-px bg-primary w-12" />
                <h3
                  className="text-2xl sm:text-3xl font-bold text-primary text-center"
                  style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
                >
                  {category.title}
                </h3>
                <div className="h-px bg-primary w-12" />
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {category.dishes.map((dish, index) => (
                  <DishCard
                    key={dish.name}
                    dish={dish}
                    index={categoryIndex * 4 + index}
                    isRTL={isRTL}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DishCard({ dish, index, isRTL }: { dish: any; index: number; isRTL: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className="group relative overflow-hidden bg-background border border-border/30 hover:border-primary/50 transition-all duration-500"
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: (index % 2) * 0.1 }}
      whileHover={{ y: -8 }}
    >
      <div className="relative h-64 sm:h-80 overflow-hidden">
        <motion.img
          src={dish.image}
          alt={dish.name}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.6 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-90" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-2xl sm:text-3xl font-bold text-primary" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
            {dish.name}
          </h3>
          {dish.price && (
            <span className="text-xl sm:text-2xl font-bold text-primary" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
              {dish.price}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base text-secondary leading-relaxed" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
          {dish.description}
        </p>
      </div>
    </motion.div>
  );
}

function ChefSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section id="chef" ref={ref} className="relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 bg-card">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Image */}
          <motion.div
            className="relative order-2 lg:order-1"
            initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="relative h-[500px] sm:h-[600px] lg:h-[700px]">
              <div className={`absolute inset-0 border-4 border-primary/20 ${isRTL ? 'translate-x-4' : '-translate-x-4'} -translate-y-4`} />
              <img
                src="https://images.unsplash.com/photo-1762254960390-139792a6417b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080"
                alt={t.chef.name}
                className="relative z-10 w-full h-full object-cover shadow-2xl"
              />
              {/* Egyptian Decorative Elements */}
              <div className="absolute -top-8 -left-8 z-20">
                <AnkhSymbol className="w-16 h-16 text-primary" />
              </div>
              <div className="absolute -bottom-8 -right-8 z-20">
                <LotusFlower className="w-16 h-16 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            className="order-1 lg:order-2"
            initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-3 text-primary mb-4">
              <ChefHat className="w-6 h-6" />
              <div className="h-px w-8 bg-primary" />
              <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {t.chef.badge}
              </span>
            </div>

            <Cartouche className="mb-6 text-primary">
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-bold"
                style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
              >
                {t.chef.title}
              </h2>
            </Cartouche>

            <p className="text-base sm:text-lg text-secondary mb-4 italic" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.chef.subtitle}
            </p>

            <p className="text-base sm:text-lg text-secondary leading-relaxed mb-6" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.chef.bio1}
            </p>

            <p className="text-base sm:text-lg text-secondary leading-relaxed mb-6" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.chef.bio2}
            </p>

            <p className="text-base sm:text-lg text-secondary leading-relaxed mb-8" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.chef.bio3}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-border/30">
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-primary mb-2" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                  25+
                </div>
                <div className="text-sm uppercase tracking-wider text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {t.chef.yearsExperience}
                </div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-bold text-primary mb-2" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                  18
                </div>
                <div className="text-sm uppercase tracking-wider text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {t.chef.awards}
                </div>
              </div>
            </div>

            {/* Philosophy */}
            <div className="bg-background/50 p-6 border-l-4 border-primary">
              <p className="text-xs uppercase tracking-wider text-primary mb-3" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {t.chef.specialty}
              </p>
              <p className="text-base sm:text-lg text-secondary italic leading-relaxed" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {t.chef.specialtyText}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AwardsSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const awards = [
    { icon: Award, title: t.awards.award1, description: t.awards.award1Desc },
    { icon: TrendingUp, title: t.awards.award2, description: t.awards.award2Desc },
    { icon: ChefHat, title: t.awards.award3, description: t.awards.award3Desc },
    { icon: Star, title: t.awards.award4, description: t.awards.award4Desc }
  ];

  return (
    <section className="relative py-20 sm:py-24 px-4 sm:px-6 bg-background">
      {/* Pyramid Pattern */}
      <PyramidPattern />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-4">
            <Scarab className="w-8 h-8" />
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.awards.badge}
            </span>
            <div className="h-px w-8 bg-primary" />
            <Scarab className="w-8 h-8" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.awards.title}
          </h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.awards.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {awards.map((award, index) => (
            <motion.div
              key={index}
              className="relative bg-card p-6 sm:p-8 border-2 border-primary/30 hover:border-primary transition-all duration-300 text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
            >
              {/* Eye of Horus at top corners */}
              <div className="absolute top-2 left-2">
                <EyeOfHorus className="w-6 h-6 text-primary/30" animate={false} />
              </div>
              <div className="absolute top-2 right-2">
                <EyeOfHorus className="w-6 h-6 text-primary/30" animate={false} />
              </div>

              <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/30">
                <award.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                {award.title}
              </h3>
              <p className="text-sm text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {award.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeritageSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const timeline = [
    { year: '1952', title: t.heritage.year1952, description: t.heritage.year1952Desc },
    { year: '1975', title: t.heritage.year1975, description: t.heritage.year1975Desc },
    { year: '1998', title: t.heritage.year1998, description: t.heritage.year1998Desc },
    { year: '2020', title: t.heritage.year2020, description: t.heritage.year2020Desc }
  ];

  const egyptianTimelineIcons = [AnkhSymbol, EyeOfHorus, LotusFlower, Scarab];

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 bg-card">
      {/* Pyramid Pattern */}
      <PyramidPattern />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-6">
            <SunDisk className="w-10 h-10" />
            <div className="h-px w-12 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.heritage.badge}
            </span>
            <div className="h-px w-12 bg-primary" />
            <SunDisk className="w-10 h-10" />
          </div>
          <Cartouche className="text-primary">
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold"
              style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
            >
              {t.heritage.title}
            </h2>
          </Cartouche>
        </motion.div>

        <div className="relative">
          {/* Timeline Line */}
          <div className={`absolute ${isRTL ? 'right-8 sm:right-1/2' : 'left-8 sm:left-1/2'} top-0 bottom-0 w-px bg-primary/30`} />

          {timeline.map((item, index) => {
            const IconComponent = egyptianTimelineIcons[index];
            return (
              <motion.div
                key={index}
                className={`relative mb-12 sm:mb-16 ${index % 2 === 0 ? 'sm:pr-1/2' : 'sm:pl-1/2'}`}
                initial={{ opacity: 0, x: isRTL ? (index % 2 === 0 ? -50 : 50) : (index % 2 === 0 ? 50 : -50) }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
              >
                <div className={`flex items-start gap-6 ${index % 2 === 0 ? 'sm:flex-row-reverse sm:text-right' : 'sm:text-left'} ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  {/* Timeline Dot with Egyptian Symbol */}
                  <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center border-4 border-card shadow-lg">
                    <IconComponent className="w-10 h-10 text-background" animate={false} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-background p-6 sm:p-8 border border-border/30 shadow-lg">
                    <div className="text-5xl sm:text-6xl font-bold text-primary/20 mb-2" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                      {item.year}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                      {item.title}
                    </h3>
                    <p className="text-base text-secondary leading-relaxed" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PrivateDiningSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const features = [
    {
      icon: Users,
      title: t.privateDining.feature1,
      description: t.privateDining.feature1Desc
    },
    {
      icon: Calendar,
      title: t.privateDining.feature2,
      description: t.privateDining.feature2Desc
    },
    {
      icon: Utensils,
      title: t.privateDining.feature3,
      description: t.privateDining.feature3Desc
    }
  ];

  return (
    <section id="events" className="relative py-24 sm:py-32 px-4 sm:px-6 bg-background">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-4">
            <LotusFlower className="w-8 h-8" />
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.privateDining.badge}
            </span>
            <div className="h-px w-8 bg-primary" />
            <LotusFlower className="w-8 h-8" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.privateDining.title}
          </h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.privateDining.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="relative bg-card p-6 sm:p-8 border-2 border-primary/30 hover:border-primary transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
            >
              {/* Papyrus Border at top */}
              <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />

              <div className="w-16 h-16 mb-6 bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-primary mb-4" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-secondary leading-relaxed" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <button
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-primary text-background px-10 py-3 text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300"
            style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
          >
            {t.privateDining.inquire}
          </button>
        </motion.div>
      </div>
    </section>
  );
}

function ExperienceSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -50]);

  const experiences = [
    { title: t.experience.authenticAmbiance, image: 'https://images.unsplash.com/photo-1762254960390-139792a6417b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800', y: y1 },
    { title: t.experience.freshIngredients, image: 'https://images.unsplash.com/photo-1762882807447-3534bff2c831?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800', y: y2 },
    { title: t.experience.culinaryArtistry, image: 'https://images.unsplash.com/photo-1628606336803-77914bbe8225?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800', y: y3 }
  ];

  return (
    <section id="experience" ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden bg-background">
      {/* Pyramid Pattern */}
      <PyramidPattern />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-4">
            <EyeOfHorus className="w-8 h-8" />
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.experience.badge}
            </span>
            <div className="h-px w-8 bg-primary" />
            <EyeOfHorus className="w-8 h-8" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.experience.title}
          </h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.experience.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {experiences.map((exp, index) => (
            <motion.div
              key={index}
              className="relative h-80 lg:h-96 overflow-hidden shadow-xl border-4 border-primary/20"
              style={{ y: exp.y }}
            >
              <img
                src={exp.image}
                alt={exp.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-6">
                <h3 className="text-xl sm:text-2xl font-bold text-primary" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                  {exp.title}
                </h3>
              </div>
              {/* Egyptian corner decorations */}
              <div className="absolute top-2 left-2">
                <AnkhSymbol className="w-6 h-6 text-primary/50" animate={false} />
              </div>
              <div className="absolute top-2 right-2">
                <AnkhSymbol className="w-6 h-6 text-primary/50" animate={false} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpecialtiesSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const specialties = [
    {
      icon: Heart,
      title: t.specialties.madeWithLove,
      description: t.specialties.madeWithLoveDesc
    },
    {
      icon: Leaf,
      title: t.specialties.freshAuthentic,
      description: t.specialties.freshAuthenticDesc
    },
    {
      icon: Flame,
      title: t.specialties.traditionalMethods,
      description: t.specialties.traditionalMethodsDesc
    }
  ];

  const egyptianSpecialtyIcons = [AnkhSymbol, LotusFlower, Scarab];

  return (
    <section className="relative py-20 sm:py-24 px-4 sm:px-6 bg-card">
      {/* Papyrus Borders */}
      <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
      <PapyrusBorder className="absolute bottom-0 left-0 right-0 text-primary rotate-180" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {specialties.map((specialty, index) => {
            const IconComponent = egyptianSpecialtyIcons[index];
            return (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {/* Egyptian Symbol */}
                <div className="flex justify-center mb-4">
                  <IconComponent className="w-16 h-16 text-primary" />
                </div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 bg-background border-2 border-primary/30 flex items-center justify-center">
                  <specialty.icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-primary mb-4" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}>
                  {specialty.title}
                </h3>
                <p className="text-sm sm:text-base text-secondary leading-relaxed" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {specialty.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const testimonials = [
    {
      text: t.testimonials.testimonial1,
      author: t.testimonials.author1,
      location: t.testimonials.location1,
      rating: 5
    },
    {
      text: t.testimonials.testimonial2,
      author: t.testimonials.author2,
      location: t.testimonials.location2,
      rating: 5
    },
    {
      text: t.testimonials.testimonial3,
      author: t.testimonials.author3,
      location: t.testimonials.location3,
      rating: 5
    }
  ];

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 bg-background">
      {/* Pyramid Pattern */}
      <PyramidPattern />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16 lg:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-4">
            <LotusFlower className="w-8 h-8" />
            <div className="h-px w-8 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.testimonials.badge}
            </span>
            <div className="h-px w-8 bg-primary" />
            <LotusFlower className="w-8 h-8" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.testimonials.title}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="relative bg-card p-6 sm:p-8 border-2 border-primary/30 hover:border-primary transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
            >
              {/* Papyrus Border at top */}
              <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />

              {/* Scarab at bottom center */}
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                <Scarab className="w-12 h-12 text-primary" animate={false} />
              </div>

              <div className="flex mb-4" style={{ justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm sm:text-base text-secondary mb-6 leading-relaxed italic" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif', textAlign: isRTL ? 'right' : 'left' }}>
                "{testimonial.text}"
              </p>
              <div className="border-t border-border/30 pt-4 pb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p className="font-bold text-primary mb-1" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {testimonial.author}
                </p>
                <p className="text-xs sm:text-sm text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
                  {testimonial.location}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GallerySection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const images = [
    'https://images.unsplash.com/photo-1628606338096-686cf7dba76a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    'https://images.unsplash.com/photo-1775181934230-a5b02e6fa1b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    'https://images.unsplash.com/photo-1653983194833-7a10838b12f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    'https://images.unsplash.com/photo-1736928633626-5c35e5677874?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    'https://images.unsplash.com/flagged/photo-1561350600-6606486921f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    'https://images.unsplash.com/photo-1775181180462-18b20da9340e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
  ];

  return (
    <section id="gallery" className="relative py-24 sm:py-32 bg-card overflow-hidden">
      {/* Pyramid Pattern */}
      <PyramidPattern />

      <motion.div
        className="relative z-10 text-center mb-12 lg:mb-16 px-4 sm:px-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="inline-flex items-center gap-3 text-primary mb-4">
          <EyeOfHorus className="w-8 h-8" />
          <div className="h-px w-8 bg-primary" />
          <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.gallery.badge}
          </span>
          <div className="h-px w-8 bg-primary" />
          <EyeOfHorus className="w-8 h-8" />
        </div>
        <h2
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary"
          style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
        >
          {t.gallery.title}
        </h2>
      </motion.div>

      <div className="flex gap-4 sm:gap-6 overflow-x-auto px-4 sm:px-6 pb-6 scrollbar-hide" dir="ltr">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="relative flex-shrink-0 w-80 sm:w-96 h-80 sm:h-96 overflow-hidden shadow-xl border-4 border-primary/30 hover:border-primary transition-all duration-300"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px 100px" }}
            transition={{ duration: 0.6, delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <img
              src={image}
              alt={`Gallery ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Egyptian corner decorations */}
            <div className="absolute top-2 left-2">
              <AnkhSymbol className="w-6 h-6 text-primary/70" animate={false} />
            </div>
            <div className="absolute top-2 right-2">
              <LotusFlower className="w-6 h-6 text-primary/70" animate={false} />
            </div>
            <div className="absolute bottom-2 left-2">
              <LotusFlower className="w-6 h-6 text-primary/70" animate={false} />
            </div>
            <div className="absolute bottom-2 right-2">
              <AnkhSymbol className="w-6 h-6 text-primary/70" animate={false} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ContactSection({ t, isRTL }: { t: Translation; isRTL: boolean }) {
  const contactIcons = [
    { Component: AnkhSymbol },
    { Component: LotusFlower },
    { Component: EyeOfHorus },
    { Component: Scarab }
  ];

  return (
    <section id="contact" className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden bg-background">
      {/* Egyptian Columns */}
      <EgyptianColumn side="left" />
      <EgyptianColumn side="right" />

      {/* Pyramid Pattern */}
      <PyramidPattern />

      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1771251059397-765d5ccbbd78?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1920')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 text-primary mb-6">
            <SunDisk className="w-12 h-12" />
            <div className="h-px w-12 bg-primary" />
            <span className="text-xs uppercase tracking-widest" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
              {t.contact.badge}
            </span>
            <div className="h-px w-12 bg-primary" />
            <SunDisk className="w-12 h-12" />
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4"
            style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif' }}
          >
            {t.contact.title}
          </h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
            {t.contact.subtitle}
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="relative bg-card p-6 sm:p-8 border-2 border-primary/30">
            <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
            <div className="absolute top-2 right-2">
              <AnkhSymbol className="w-6 h-6 text-primary/30" animate={false} />
            </div>
            <MapPin className="w-8 h-8 text-primary mb-4" style={{ marginLeft: isRTL ? 'auto' : '0', marginRight: isRTL ? '0' : 'auto' }} />
            <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.location}
            </h3>
            <p className="text-base sm:text-lg text-secondary whitespace-pre-line" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.locationAddress}
            </p>
          </div>

          <div className="relative bg-card p-6 sm:p-8 border-2 border-primary/30">
            <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
            <div className="absolute top-2 right-2">
              <LotusFlower className="w-6 h-6 text-primary/30" animate={false} />
            </div>
            <Clock className="w-8 h-8 text-primary mb-4" style={{ marginLeft: isRTL ? 'auto' : '0', marginRight: isRTL ? '0' : 'auto' }} />
            <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.openingHours}
            </h3>
            <p className="text-base sm:text-lg text-secondary whitespace-pre-line" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.hours}
            </p>
          </div>

          <div className="relative bg-card p-6 sm:p-8 border-2 border-primary/30">
            <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
            <div className="absolute top-2 right-2">
              <EyeOfHorus className="w-6 h-6 text-primary/30" animate={false} />
            </div>
            <Phone className="w-8 h-8 text-primary mb-4" style={{ marginLeft: isRTL ? 'auto' : '0', marginRight: isRTL ? '0' : 'auto' }} />
            <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.phone}
            </h3>
            <p className="text-base sm:text-lg text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif', textAlign: isRTL ? 'right' : 'left' }}>
              +20 2 1234 5678<br />
              +20 2 8765 4321
            </p>
          </div>

          <div className="relative bg-card p-6 sm:p-8 border-2 border-primary/30">
            <PapyrusBorder className="absolute top-0 left-0 right-0 text-primary" />
            <div className="absolute top-2 right-2">
              <Scarab className="w-6 h-6 text-primary/30" animate={false} />
            </div>
            <Mail className="w-8 h-8 text-primary mb-4" style={{ marginLeft: isRTL ? 'auto' : '0', marginRight: isRTL ? '0' : 'auto' }} />
            <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3" style={{ fontFamily: isRTL ? 'Amiri, serif' : 'Playfair Display, serif', textAlign: isRTL ? 'right' : 'left' }}>
              {t.contact.email}
            </h3>
            <p className="text-base sm:text-lg text-secondary" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif', textAlign: isRTL ? 'right' : 'left' }}>
              hello@nileheritage.com<br />
              reservations@nileheritage.com
            </p>
          </div>
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <motion.button
            className="bg-primary text-background px-10 sm:px-12 py-3 sm:py-4 text-sm sm:text-base uppercase tracking-wider hover:bg-opacity-90 transition-all duration-300 shadow-lg"
            style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}
            whileHover={{ scale: 1.05 }}
          >
            {t.contact.makeReservation}
          </motion.button>
        </motion.div>
      </div>

      <motion.div
        className="relative z-10 text-center mt-16 sm:mt-20 pt-8 sm:pt-12 border-t border-border/30"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <p className="text-xs sm:text-sm text-muted-foreground mb-2" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
          {t.contact.footer1}
        </p>
        <p className="text-xs text-muted-foreground" style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
          {t.contact.footer2}
        </p>
      </motion.div>
    </section>
  );
}
