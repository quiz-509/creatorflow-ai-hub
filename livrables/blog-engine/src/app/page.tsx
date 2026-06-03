import { Suspense } from 'react';
import { getPublishedArticles } from '@/lib/supabase';
import ArticleCard from '@/components/ArticleCard';
import FeaturedArticle from '@/components/FeaturedArticle';
import CategoryFilter from '@/components/CategoryFilter';
import Newsletter from '@/components/Newsletter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog IA — CreatorFlow Market | Actualités IA Francophones',
  description: 'Actualités IA, outils, tutoriels et stratégies pour créateurs et entrepreneurs francophones. Contenu généré et curé par IA.',
  openGraph: {
    title: 'Blog IA — CreatorFlow Market',
    description: 'Le meilleur contenu IA pour les créateurs francophones.',
    type: 'website',
  },
};

export const revalidate = 3600; // ISR: revalider toutes les heures

async function BlogContent({ category }: { category?: string }) {
  const { data: articles } = await getPublishedArticles({
    category,
    limit: 10,
  });

  if (!articles?.length) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9898B8' }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🤖</p>
      <h3>Premiers articles en cours de génération…</h3>
      <p>Revenez dans quelques heures.</p>
    </div>
  );

  const featured = articles.find(a => a.is_featured) || articles[0];
  const grid     = articles.filter(a => a.id !== featured?.id);

  return (
    <>
      {featured && <FeaturedArticle article={featured}/>}
      <div className="articles-grid">
        {grid.map(article => (
          <ArticleCard key={article.id} article={article}/>
        ))}
      </div>
    </>
  );
}

export default function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  return (
    <main>
      <section className="blog-hero">
        <div className="container">
          <div className="hero-badge">
            <span className="pulse-dot"/>
            CreatorFlow AI News Engine
          </div>
          <h1>Le meilleur de l&apos;<span className="gradient-text">Intelligence Artificielle</span> pour les créateurs francophones</h1>
          <p>Actualités IA, outils et stratégies publiés automatiquement chaque semaine.</p>
        </div>
      </section>

      <CategoryFilter active={searchParams.category}/>

      <section className="blog-content">
        <div className="container">
          <Suspense fallback={<BlogSkeleton/>}>
            <BlogContent category={searchParams.category}/>
          </Suspense>
        </div>
      </section>

      <Newsletter/>
    </main>
  );
}

function BlogSkeleton() {
  return (
    <div className="articles-grid">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="article-card skeleton-card"/>
      ))}
    </div>
  );
}
