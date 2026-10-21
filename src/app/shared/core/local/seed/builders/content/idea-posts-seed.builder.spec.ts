import datingArticles from '../../data/dating-articles.json';
import workArticles from '../../data/work-articles.json';
import communityArticles from '../../data/community-articles.json';
import { SeedIdeaPostsBuilder } from './idea-posts-seed.builder';

describe('SeedIdeaPostsBuilder', () => {
  it('embeds each primary image in the article detail HTML', () => {
    const posts = SeedIdeaPostsBuilder.buildDefaultPosts();

    expect(posts).toHaveLength(datingArticles.length + workArticles.length + communityArticles.length);
    for (const post of posts) {
      expect(post.imageUrl).toBeTruthy();
      expect(post.imageUrls).toContain(post.imageUrl);
      expect(post.contentHtml).toContain(post.imageUrl);
    }
  });
});
