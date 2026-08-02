/**
 * Curated city list for manual prayer-time location selection - Gulf/MENA
 * cities first (this app's actual target markets per PROJECT.md), then
 * major world cities for global reach. A full geo-database (e.g. the
 * `cities.json` npm package) is 19.5 MB unpacked - far too large to
 * bundle - so this is a deliberately small, curated 68-city
 * list instead. Coordinates fetched live from the free Open-Meteo
 * geocoding API (open-meteo.com, no key required) on 2026-08-02, not
 * fabricated. Arabic names are hand-mapped standard city names, not
 * machine-translated.
 */
export interface CityOption {
  name: string;
  nameAr: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

export const CURATED_CITIES: CityOption[] = [
  {
    "name": "Mecca",
    "nameAr": "مكة المكرمة",
    "country": "Saudi Arabia",
    "countryCode": "SA",
    "lat": 21.4266,
    "lon": 39.8256
  },
  {
    "name": "Medina",
    "nameAr": "المدينة المنورة",
    "country": "Saudi Arabia",
    "countryCode": "SA",
    "lat": 24.4686,
    "lon": 39.6142
  },
  {
    "name": "Riyadh",
    "nameAr": "الرياض",
    "country": "Saudi Arabia",
    "countryCode": "SA",
    "lat": 24.6877,
    "lon": 46.7219
  },
  {
    "name": "Jeddah",
    "nameAr": "جدة",
    "country": "Saudi Arabia",
    "countryCode": "SA",
    "lat": 21.4901,
    "lon": 39.1862
  },
  {
    "name": "Dammam",
    "nameAr": "الدمام",
    "country": "Saudi Arabia",
    "countryCode": "SA",
    "lat": 26.4344,
    "lon": 50.1033
  },
  {
    "name": "Dubai",
    "nameAr": "دبي",
    "country": "United Arab Emirates",
    "countryCode": "AE",
    "lat": 25.0772,
    "lon": 55.3093
  },
  {
    "name": "Abu Dhabi",
    "nameAr": "أبوظبي",
    "country": "United Arab Emirates",
    "countryCode": "AE",
    "lat": 24.4512,
    "lon": 54.397
  },
  {
    "name": "Sharjah",
    "nameAr": "الشارقة",
    "country": "United Arab Emirates",
    "countryCode": "AE",
    "lat": 25.3342,
    "lon": 55.4122
  },
  {
    "name": "Doha",
    "nameAr": "الدوحة",
    "country": "Qatar",
    "countryCode": "QA",
    "lat": 25.2855,
    "lon": 51.531
  },
  {
    "name": "Kuwait City",
    "nameAr": "مدينة الكويت",
    "country": "Kuwait",
    "countryCode": "KW",
    "lat": 29.367,
    "lon": 47.9743
  },
  {
    "name": "Manama",
    "nameAr": "المنامة",
    "country": "Bahrain",
    "countryCode": "BH",
    "lat": 26.2279,
    "lon": 50.5857
  },
  {
    "name": "Muscat",
    "nameAr": "مسقط",
    "country": "Oman",
    "countryCode": "OM",
    "lat": 23.5841,
    "lon": 58.4078
  },
  {
    "name": "Cairo",
    "nameAr": "القاهرة",
    "country": "Egypt",
    "countryCode": "EG",
    "lat": 30.0626,
    "lon": 31.2497
  },
  {
    "name": "Alexandria",
    "nameAr": "الإسكندرية",
    "country": "Egypt",
    "countryCode": "EG",
    "lat": 31.2018,
    "lon": 29.9158
  },
  {
    "name": "Giza",
    "nameAr": "الجيزة",
    "country": "Egypt",
    "countryCode": "EG",
    "lat": 30.0094,
    "lon": 31.2086
  },
  {
    "name": "Baghdad",
    "nameAr": "بغداد",
    "country": "Iraq",
    "countryCode": "IQ",
    "lat": 33.3406,
    "lon": 44.4009
  },
  {
    "name": "Basra",
    "nameAr": "البصرة",
    "country": "Iraq",
    "countryCode": "IQ",
    "lat": 30.5085,
    "lon": 47.7804
  },
  {
    "name": "Erbil",
    "nameAr": "أربيل",
    "country": "Iraq",
    "countryCode": "IQ",
    "lat": 36.1912,
    "lon": 44.0094
  },
  {
    "name": "Amman",
    "nameAr": "عمّان",
    "country": "Jordan",
    "countryCode": "JO",
    "lat": 31.9552,
    "lon": 35.945
  },
  {
    "name": "Beirut",
    "nameAr": "بيروت",
    "country": "Lebanon",
    "countryCode": "LB",
    "lat": 33.8933,
    "lon": 35.5016
  },
  {
    "name": "Damascus",
    "nameAr": "دمشق",
    "country": "Syria",
    "countryCode": "SY",
    "lat": 33.5102,
    "lon": 36.2913
  },
  {
    "name": "Ramallah",
    "nameAr": "رام الله",
    "country": "Palestine",
    "countryCode": "PS",
    "lat": 31.8996,
    "lon": 35.2042
  },
  {
    "name": "Gaza",
    "nameAr": "غزة",
    "country": "Palestine",
    "countryCode": "PS",
    "lat": 31.5016,
    "lon": 34.4667
  },
  {
    "name": "Sanaa",
    "nameAr": "صنعاء",
    "country": "Yemen",
    "countryCode": "YE",
    "lat": 15.3545,
    "lon": 44.2065
  },
  {
    "name": "Tripoli",
    "nameAr": "طرابلس",
    "country": "Libya",
    "countryCode": "LY",
    "lat": 32.8874,
    "lon": 13.1873
  },
  {
    "name": "Tunis",
    "nameAr": "تونس",
    "country": "Tunisia",
    "countryCode": "TN",
    "lat": 36.819,
    "lon": 10.1658
  },
  {
    "name": "Algiers",
    "nameAr": "الجزائر",
    "country": "Algeria",
    "countryCode": "DZ",
    "lat": 36.7323,
    "lon": 3.0875
  },
  {
    "name": "Rabat",
    "nameAr": "الرباط",
    "country": "Morocco",
    "countryCode": "MA",
    "lat": 34.0132,
    "lon": -6.8326
  },
  {
    "name": "Casablanca",
    "nameAr": "الدار البيضاء",
    "country": "Morocco",
    "countryCode": "MA",
    "lat": 33.5883,
    "lon": -7.6114
  },
  {
    "name": "Khartoum",
    "nameAr": "الخرطوم",
    "country": "Sudan",
    "countryCode": "SD",
    "lat": 15.5518,
    "lon": 32.5324
  },
  {
    "name": "Istanbul",
    "nameAr": "إسطنبول",
    "country": "Republic of Türkiye",
    "countryCode": "TR",
    "lat": 41.0138,
    "lon": 28.9497
  },
  {
    "name": "Ankara",
    "nameAr": "أنقرة",
    "country": "Republic of Türkiye",
    "countryCode": "TR",
    "lat": 39.9199,
    "lon": 32.8543
  },
  {
    "name": "Tehran",
    "nameAr": "طهران",
    "country": "Iran",
    "countryCode": "IR",
    "lat": 35.6944,
    "lon": 51.4215
  },
  {
    "name": "Mashhad",
    "nameAr": "مشهد",
    "country": "Iran",
    "countryCode": "IR",
    "lat": 36.2981,
    "lon": 59.6057
  },
  {
    "name": "Karachi",
    "nameAr": "كراتشي",
    "country": "Pakistan",
    "countryCode": "PK",
    "lat": 24.8608,
    "lon": 67.0104
  },
  {
    "name": "Lahore",
    "nameAr": "لاهور",
    "country": "Pakistan",
    "countryCode": "PK",
    "lat": 31.558,
    "lon": 74.3507
  },
  {
    "name": "Islamabad",
    "nameAr": "إسلام آباد",
    "country": "Pakistan",
    "countryCode": "PK",
    "lat": 33.7215,
    "lon": 73.0433
  },
  {
    "name": "Dhaka",
    "nameAr": "دكا",
    "country": "Bangladesh",
    "countryCode": "BD",
    "lat": 23.7104,
    "lon": 90.4074
  },
  {
    "name": "Delhi",
    "nameAr": "دلهي",
    "country": "India",
    "countryCode": "IN",
    "lat": 28.6519,
    "lon": 77.2315
  },
  {
    "name": "Mumbai",
    "nameAr": "مومباي",
    "country": "India",
    "countryCode": "IN",
    "lat": 19.0728,
    "lon": 72.8826
  },
  {
    "name": "Hyderabad",
    "nameAr": "حيدر أباد",
    "country": "India",
    "countryCode": "IN",
    "lat": 17.384,
    "lon": 78.4564
  },
  {
    "name": "Jakarta",
    "nameAr": "جاكرتا",
    "country": "Indonesia",
    "countryCode": "ID",
    "lat": -6.2146,
    "lon": 106.8451
  },
  {
    "name": "Kuala Lumpur",
    "nameAr": "كوالالمبور",
    "country": "Malaysia",
    "countryCode": "MY",
    "lat": 3.1412,
    "lon": 101.6865
  },
  {
    "name": "Singapore",
    "nameAr": "سنغافورة",
    "country": "Singapore",
    "countryCode": "SG",
    "lat": 1.2897,
    "lon": 103.8501
  },
  {
    "name": "Manila",
    "nameAr": "مانيلا",
    "country": "Philippines",
    "countryCode": "PH",
    "lat": 14.6042,
    "lon": 120.9822
  },
  {
    "name": "Lagos",
    "nameAr": "لاغوس",
    "country": "Nigeria",
    "countryCode": "NG",
    "lat": 6.4541,
    "lon": 3.3947
  },
  {
    "name": "Abuja",
    "nameAr": "أبوجا",
    "country": "Nigeria",
    "countryCode": "NG",
    "lat": 9.0579,
    "lon": 7.4951
  },
  {
    "name": "Johannesburg",
    "nameAr": "جوهانسبرغ",
    "country": "South Africa",
    "countryCode": "ZA",
    "lat": -26.2023,
    "lon": 28.0436
  },
  {
    "name": "Cape Town",
    "nameAr": "كيب تاون",
    "country": "South Africa",
    "countryCode": "ZA",
    "lat": -33.9258,
    "lon": 18.4232
  },
  {
    "name": "Nairobi",
    "nameAr": "نيروبي",
    "country": "Kenya",
    "countryCode": "KE",
    "lat": -1.2833,
    "lon": 36.8167
  },
  {
    "name": "London",
    "nameAr": "لندن",
    "country": "United Kingdom",
    "countryCode": "GB",
    "lat": 51.5085,
    "lon": -0.1257
  },
  {
    "name": "Paris",
    "nameAr": "باريس",
    "country": "France",
    "countryCode": "FR",
    "lat": 48.8534,
    "lon": 2.3488
  },
  {
    "name": "Berlin",
    "nameAr": "برلين",
    "country": "Germany",
    "countryCode": "DE",
    "lat": 52.5244,
    "lon": 13.4105
  },
  {
    "name": "Amsterdam",
    "nameAr": "أمستردام",
    "country": "The Netherlands",
    "countryCode": "NL",
    "lat": 52.374,
    "lon": 4.8897
  },
  {
    "name": "Moscow",
    "nameAr": "موسكو",
    "country": "Russia",
    "countryCode": "RU",
    "lat": 55.752,
    "lon": 37.6178
  },
  {
    "name": "Madrid",
    "nameAr": "مدريد",
    "country": "Spain",
    "countryCode": "ES",
    "lat": 40.4165,
    "lon": -3.7026
  },
  {
    "name": "Rome",
    "nameAr": "روما",
    "country": "Italy",
    "countryCode": "IT",
    "lat": 41.8919,
    "lon": 12.5113
  },
  {
    "name": "New York",
    "nameAr": "نيويورك",
    "country": "United States",
    "countryCode": "US",
    "lat": 40.7143,
    "lon": -74.006
  },
  {
    "name": "Chicago",
    "nameAr": "شيكاغو",
    "country": "United States",
    "countryCode": "US",
    "lat": 41.85,
    "lon": -87.65
  },
  {
    "name": "Houston",
    "nameAr": "هيوستن",
    "country": "United States",
    "countryCode": "US",
    "lat": 29.7633,
    "lon": -95.3633
  },
  {
    "name": "Los Angeles",
    "nameAr": "لوس أنجلوس",
    "country": "United States",
    "countryCode": "US",
    "lat": 34.0522,
    "lon": -118.2437
  },
  {
    "name": "Dearborn",
    "nameAr": "ديربورن",
    "country": "United States",
    "countryCode": "US",
    "lat": 42.3223,
    "lon": -83.1763
  },
  {
    "name": "Toronto",
    "nameAr": "تورونتو",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 43.7064,
    "lon": -79.3986
  },
  {
    "name": "Montreal",
    "nameAr": "مونتريال",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 45.5088,
    "lon": -73.5878
  },
  {
    "name": "Sydney",
    "nameAr": "سيدني",
    "country": "Australia",
    "countryCode": "AU",
    "lat": -33.8678,
    "lon": 151.2073
  },
  {
    "name": "Melbourne",
    "nameAr": "ملبورن",
    "country": "Australia",
    "countryCode": "AU",
    "lat": -37.814,
    "lon": 144.9633
  },
  {
    "name": "Beijing",
    "nameAr": "بكين",
    "country": "China",
    "countryCode": "CN",
    "lat": 39.9075,
    "lon": 116.3972
  },
  {
    "name": "Tokyo",
    "nameAr": "طوكيو",
    "country": "Japan",
    "countryCode": "JP",
    "lat": 35.6895,
    "lon": 139.6917
  }
];
