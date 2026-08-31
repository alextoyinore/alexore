from datetime import datetime
from app import create_app, db
from app.models import Post, Tag, Subscriber

app = create_app()

def seed_database():
    with app.app_context():
        db.create_all()

        if Post.query.first():
            print("Database already contains data.")
            return

        # Create Tags
        tag_mind = Tag(name="Mindset", slug="mindset")
        tag_systems = Tag(name="Systems", slug="systems")
        tag_future = Tag(name="Future of Work", slug="future-of-work")
        tag_writing = Tag(name="Writing", slug="writing")
        db.session.add_all([tag_mind, tag_systems, tag_future, tag_writing])
        db.session.commit()

        # Post 1 (Featured)
        p1 = Post(
            title="The One-Person Business Model for Modern Creators",
            slug="one-person-business-model",
            subtitle="How to synthesize your skills, build leverage, and escape the 9-to-5 grind without raising venture capital.",
            content_html="""
            <p>The traditional career ladder is breaking. The future belongs to the multi-passionate individual who builds a personal media engine around their unique perspective.</p>
            <h2>1. The Power of Personal Leverage</h2>
            <p>In the digital age, code and media are permissionless leverage. You can write an essay once and have 100,000 people read it while you sleep. The goal of a modern creator is not just to sell time, but to build digital assets that compound over years.</p>
            <blockquote>"You will get rich by giving society what it wants but does not yet know how to get. At scale." — Naval Ravikant</blockquote>
            <h2>2. Synthesizing Your Interests</h2>
            <p>Don't pick a narrow niche. Instead, become the intersection of 3–4 distinct domains. If you combine design, coding, psychology, and storytelling, you become a category of one.</p>
            <p>Focus on long-form writing as your core thinking practice. Writing is the highest-leverage skill on the internet.</p>
            """,
            status=Post.STATUS_PUBLISHED,
            featured=True,
            reading_time=4,
            published_at=datetime.utcnow(),
            cover_image="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
            cover_image_alt="Laptop on dark desk"
        )
        p1.tags.append(tag_systems)
        p1.tags.append(tag_future)

        # Post 2
        p2 = Post(
            title="You Don't Need a Niche, You Need a Point of View",
            slug="you-dont-need-a-niche",
            subtitle="Why hyper-specialization is a trap for creative minds and how to build a broad audience based on identity.",
            content_html="""
            <p>Most advice tells you to pick a single micro-niche. But human beings are multi-dimensional. When you box yourself into one tiny subculture, you get bored and burn out.</p>
            <h2>The Identity-Based Brand</h2>
            <p>Instead of niching down on a topic, niche down on your <strong>worldview</strong>. People don't just consume content for raw information; they consume it for the perspective of the curator.</p>
            <p>Share your curiosities, your experiments, and your internal monologues. That is how you build true alignment with your readers.</p>
            """,
            status=Post.STATUS_PUBLISHED,
            featured=False,
            reading_time=3,
            published_at=datetime.utcnow(),
            cover_image="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
            cover_image_alt="Writing notebook and coffee"
        )
        p2.tags.append(tag_mind)
        p2.tags.append(tag_writing)

        # Post 3
        p3 = Post(
            title="Deep Work vs Fast Reaction: Winning the Attention War",
            slug="deep-work-vs-fast-reaction",
            subtitle="Designing a daily system to protect your focus and create compounding output.",
            content_html="""
            <p>The modern internet is engineered to keep you in a state of continuous low-grade distraction. If you cannot focus for 3 uninterrupted hours, you are at a massive disadvantage.</p>
            <h2>Building Your Focus Sanctuary</h2>
            <p>Turn off notifications. Block social feeds during your morning deep work block. Treat your attention as your most valuable capital asset.</p>
            """,
            status=Post.STATUS_PUBLISHED,
            featured=False,
            reading_time=5,
            published_at=datetime.utcnow(),
            cover_image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
            cover_image_alt="Minimalist horizon"
        )
        p3.tags.append(tag_mind)
        p3.tags.append(tag_systems)

        # Subscriber seed
        sub1 = Subscriber(email="reader@example.com", name="Alex Reader", source="homepage")
        db.session.add_all([p1, p2, p3, sub1])
        db.session.commit()
        print("Database successfully seeded with sample essays and subscriber!")

if __name__ == "__main__":
    seed_database()
