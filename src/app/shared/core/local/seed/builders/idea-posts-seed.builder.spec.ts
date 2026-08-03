import { SeedIdeaPostsBuilder } from './idea-posts-seed.builder';

describe('SeedIdeaPostsBuilder', () => {
  it('embeds each primary image in the article detail HTML', () => {
    const posts = SeedIdeaPostsBuilder.buildDefaultPosts();

    expect(posts).toHaveLength(10);
    for (const post of posts) {
      expect(post.imageUrl).toBeTruthy();
      expect(post.imageUrls).toContain(post.imageUrl);
      expect(post.contentHtml).toContain(post.imageUrl);
    }
  });
});
