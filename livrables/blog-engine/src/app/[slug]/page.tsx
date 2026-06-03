import { notFound } from 'next/navigation';
import { getArticleBySlug, getPublishedArticles, incrementViews } from '@/lib/supabase';
import ArticleCard from '@/components/ArticleCard';
import type { Metadata } from 'next';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await getArticleBySlug(params.slug);
  if (!data) return { title: 'Article non trouvé' };
  return {
    title: `${data.title} — CreatorFlow Market`,
    description: data.meta_description || data.excerpt,
    openGraph: {
      title: data.title,
      description: data.meta_description || data.excerpt,
      type: 'article',
      images: data.og_image ? [data.og_image] : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { data: article } = await getArticleBySlug(params.slug);
  if (!article) notFound();

  // Incrémenter vues en arrière-plan
  incrementViews(params.slug).catch(() => {});

  const { data: related } = await getPublishedArticles({ category: article.category, limit: 3 });
  const relatedFiltered   = (related || []).filter(a => a.id !== article.id).slice(0, 3);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description || article.excerpt,
    author: { '@type': 'Organization', name: 'CreatorFlow Market' },
    publisher: { '@type': 'Organization', name: 'CreatorFlow Market', url: 'https://creatorflowmarket.com' },
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    image: article.og_image || article.featured_image,
    url: `https://creatorflowmarket.com/blog/${article.slug}`,
  };

  return (
    <main className="article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="article-hero" style={{
        background: `linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)`,
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        padding: '80px 0 48px',
      }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="cat-badge" data-cat={article.category}>{article.category}</div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, lineHeight: 1.2, margin: '16px 0' }}>
            {article.title}
          </h1>
          {article.subtitle && (
            <p style={{ fontSize: 18, color: '#9898B8', marginBottom: 24 }}>{article.subtitle}</p>
          )}
          <div className="article-meta-row">
            <span>✍️ {article.author}</span>
            <span>📖 {article.reading_time} min de lecture</span>
            <span>👁 {article.views.toLocaleString()} vues</span>
            {article.published_at && (
              <span>📅 {new Date(article.published_at).toLocaleDateString('fr-CA', { day:'numeric', month:'long', year:'numeric' })}</span>
            )}
            {article.seo_score > 0 && (
              <span style={{ color: article.seo_score >= 80 ? '#10B981' : '#F59E0B' }}>
                SEO: {article.seo_score}/100
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="article-body-wrap">
        <div className="container" style={{ maxWidth: 860 }}>
          {article.content ? (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
            <p style={{ color: '#9898B8' }}>Contenu en cours de chargement…</p>
          )}

          {article.tags?.length > 0 && (
            <div className="article-tags">
              {article.tags.map((tag: string) => (
                <span key={tag} className="tag-pill">{tag}</span>
              ))}
            </div>
          )}

          <div className="article-cta">
            <h3>🚀 Trouvez un expert IA sur CreatorFlow Market</h3>
            <p>Besoin d&apos;aide pour implémenter ces stratégies ? Nos experts IA certifiés sont disponibles pour vos projets.</p>
            <a href="https://creatorflowmarket.com/experts.html" className="cta-btn">
              Parcourir les experts IA →
            </a>
          </div>

          <div className="article-share">
            <span>Partager :</span>
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent('https://creatorflowmarket.com/blog/'+article.slug)}`} target="_blank" rel="noopener">X (Twitter)</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://creatorflowmarket.com/blog/'+article.slug)}`} target="_blank" rel="noopener">LinkedIn</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://creatorflowmarket.com/blog/'+article.slug)}`} target="_blank" rel="noopener">Facebook</a>
          </div>
        </div>
      </div>

      {relatedFiltered.length > 0 && (
        <section className="related-section">
          <div className="container">
            <h2>Articles similaires</h2>
            <div className="articles-grid">
              {relatedFiltered.map(a => <ArticleCard key={a.id} article={a}/>)}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
