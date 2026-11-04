-- Create articles table for storing processed news content
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta_description TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  image_url TEXT,
  content TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_articles_published ON public.articles(published, created_at DESC);
CREATE INDEX idx_articles_category ON public.articles(category);
CREATE INDEX idx_articles_slug ON public.articles(slug);

-- Enable Row Level Security
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published articles
CREATE POLICY "Anyone can view published articles"
ON public.articles
FOR SELECT
USING (published = true);

-- Allow all operations for authenticated users (admin/editor access)
CREATE POLICY "Authenticated users can manage articles"
ON public.articles
FOR ALL
USING (auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_articles_updated_at();

-- Create RSS feeds table to track sources
CREATE TABLE public.rss_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on RSS feeds
ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active feeds
CREATE POLICY "Anyone can view active feeds"
ON public.rss_feeds
FOR SELECT
USING (active = true);

-- Allow authenticated users to manage feeds
CREATE POLICY "Authenticated users can manage feeds"
ON public.rss_feeds
FOR ALL
USING (auth.role() = 'authenticated');

-- Insert default RSS feeds
INSERT INTO public.rss_feeds (name, url) VALUES
('TechCrunch Fintech', 'https://techcrunch.com/category/fintech/feed/'),
('Finextra', 'https://www.finextra.com/rss/news'),
('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
('Sifted', 'https://sifted.eu/feed'),
('Investopedia', 'https://www.investopedia.com/feed.xml'),
('Cointelegraph', 'https://cointelegraph.com/rss');