
-- Update about body
UPDATE sip_landing_page_config 
SET value_text = 'Smart Income Program is a private, members-only platform designed to help driven individuals build a secondary income through structured learning, expert mentorship, and proven systems.

Our program provides a step-by-step digital learning experience with access to training videos, live sessions, and a supportive community of like-minded individuals.

Whether you are just getting started or looking to scale your existing team, our platform gives you the tools and knowledge to succeed as a digital entrepreneur.'
WHERE section = 'about' AND key = 'body';

-- Update community body
UPDATE sip_landing_page_config 
SET value_text = 'Join a supportive community of digital entrepreneurs who are building their income together through shared knowledge, expert guidance, and proven strategies.'
WHERE section = 'community' AND key = 'body';

-- Update disclaimer
UPDATE sip_landing_page_config 
SET value_text = 'Smart Income Program is a private educational platform designed for members of our digital income program. This platform and its contents are intended for internal training and educational purposes only.

Income results are not guaranteed. Individual results may vary based on effort, skills, and market conditions. The testimonials shown are from real members and represent their individual experiences.

This platform is not affiliated with any third-party organization or company. For questions, contact the program administrator.'
WHERE section = 'disclaimer' AND key = 'content';

-- Update FAQ
UPDATE sip_faq_items 
SET answer = 'This program is designed for team leaders and members of our digital income community who want to learn and grow through structured digital training.'
WHERE question = 'Who is this program for?';
