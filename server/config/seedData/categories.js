/**
 * Seed data for quiz categories
 */
const categories = [
  {
    name: 'History',
    description: 'Questions about significant events, periods, and figures from the past',
    iconName: 'history',
    color: '#8B4513',
    difficulty: 3
  },
  {
    name: 'Science',
    description: 'Questions covering physics, chemistry, biology, and general scientific knowledge',
    iconName: 'science',
    color: '#4169E1',
    difficulty: 4
  },
  {
    name: 'Geography',
    description: 'Questions about countries, cities, landmarks, and physical features of the Earth',
    iconName: 'globe',
    color: '#2E8B57',
    difficulty: 3
  },
  {
    name: 'Literature',
    description: 'Questions about authors, books, literary characters, and famous works',
    iconName: 'book',
    color: '#8A2BE2',
    difficulty: 4
  },
  {
    name: 'Entertainment',
    description: 'Questions covering movies, TV shows, music, and popular culture',
    iconName: 'tv',
    color: '#FF69B4',
    difficulty: 2
  },
  {
    name: 'Sports',
    description: 'Questions about athletes, teams, competitions, and sporting events',
    iconName: 'sports',
    color: '#FF4500',
    difficulty: 3
  },
  {
    name: 'Technology',
    description: 'Questions about computers, software, gadgets, and technological innovations',
    iconName: 'computer',
    color: '#1E90FF',
    difficulty: 3
  },
  {
    name: 'Food & Drink',
    description: 'Questions about cuisine, cooking, beverages, and food culture',
    iconName: 'food',
    color: '#DAA520',
    difficulty: 2
  },
  {
    name: 'Art',
    description: 'Questions about painters, sculptures, art movements, and famous works',
    iconName: 'art',
    color: '#9932CC',
    difficulty: 4
  },
  {
    name: 'Music',
    description: 'Questions about musicians, bands, songs, and music theory',
    iconName: 'music',
    color: '#FF1493',
    difficulty: 3
  },
  {
    name: 'General Knowledge',
    description: 'A mix of questions covering a broad range of topics',
    iconName: 'info',
    color: '#3CB371',
    difficulty: 2
  },
  {
    name: 'Science Fiction',
    description: 'Questions about sci-fi movies, books, and TV shows',
    iconName: 'rocket',
    color: '#483D8B',
    difficulty: 3,
    parentCategory: 'Entertainment'  // This will be handled in the seed script
  }
];

module.exports = categories;
