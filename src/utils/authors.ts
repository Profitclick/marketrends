export interface Author {
  id: string;
  name: string;
  role: string;
  image: string;
  bio: string;
}

export const authors: Author[] = [
  {
    id: "erik-lunde",
    name: "Erik Lunde",
    role: "Ansvarlig redaktør",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=faces",
    bio: "Erfaren finansjournalist med 15 år i bransjen. Tidligere økonomisjef i Finansavisen."
  },
  {
    id: "nora-aasheim",
    name: "Nora Aasheim",
    role: "Teknologiredaktør",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces",
    bio: "Spesialist på fintech og digital innovasjon. Master i informatikk fra NTNU."
  },
  {
    id: "jonas-vik",
    name: "Jonas Vik",
    role: "Kryptoanalytiker",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces",
    bio: "Kryptovaluta-ekspert og blockchain-utvikler. Skriver om desentralisert finans."
  },
  {
    id: "sara-halvorsen",
    name: "Sara Halvorsen",
    role: "Markedsanalytiker",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=faces",
    bio: "Analyseekspert med fokus på nordiske aksjemarkeder og startup-økosystemet."
  }
];

export const getRandomAuthor = (): Author => {
  const journalistAuthors = authors.filter(a => a.role !== "Ansvarlig redaktør");
  return journalistAuthors[Math.floor(Math.random() * journalistAuthors.length)];
};

export const getEditorInChief = (): Author => {
  return authors.find(a => a.role === "Ansvarlig redaktør")!;
};

export const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};
