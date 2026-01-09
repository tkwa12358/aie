import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /learning/progress - 获取用户的学习进度
 */
router.get('/progress', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { videoId } = req.query;

        if (videoId) {
            const progress = queryOne(
                'SELECT * FROM learning_progress WHERE user_id = ? AND video_id = ?',
                [userId, videoId]
            );
            return res.json(progress || { lastPosition: 0, completedSentences: [], totalPracticeTime: 0 });
        }

        const progresses = query(
            `SELECT lp.*, v.title as video_title 
       FROM learning_progress lp
       LEFT JOIN videos v ON lp.video_id = v.id
       WHERE lp.user_id = ?
       ORDER BY lp.updated_at DESC`,
            [userId]
        );

        res.json(progresses);
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ error: '获取学习进度失败' });
    }
});

/**
 * POST /learning/progress - 更新学习进度
 */
router.post('/progress', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { videoId, lastPosition, completedSentences, practiceTime } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: '请提供视频ID' });
        }

        const existing = queryOne<any>(
            'SELECT id, total_practice_time FROM learning_progress WHERE user_id = ? AND video_id = ?',
            [userId, videoId]
        );

        if (existing) {
            const updates: string[] = [];
            const params: any[] = [];

            if (lastPosition !== undefined) { updates.push('last_position = ?'); params.push(lastPosition); }
            if (completedSentences !== undefined) { updates.push('completed_sentences = ?'); params.push(JSON.stringify(completedSentences)); }
            if (practiceTime !== undefined) { updates.push('total_practice_time = total_practice_time + ?'); params.push(practiceTime); }

            if (updates.length > 0) {
                updates.push("updated_at = datetime('now')");
                params.push(userId, videoId);
                update(`UPDATE learning_progress SET ${updates.join(', ')} WHERE user_id = ? AND video_id = ?`, params);
            }
        } else {
            const id = uuidv4();
            run(
                `INSERT INTO learning_progress (id, user_id, video_id, last_position, completed_sentences, total_practice_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [id, userId, videoId, lastPosition || 0, JSON.stringify(completedSentences || []), practiceTime || 0]
            );
        }

        // 更新用户统计
        if (practiceTime && practiceTime > 0) {
            const existingStats = queryOne('SELECT id FROM user_statistics WHERE user_id = ?', [userId]);
            if (existingStats) {
                update(
                    `UPDATE user_statistics SET total_practice_time = total_practice_time + ?, today_practice_time = today_practice_time + ?, updated_at = datetime('now') WHERE user_id = ?`,
                    [practiceTime, practiceTime, userId]
                );
            } else {
                run(
                    `INSERT INTO user_statistics (id, user_id, total_practice_time, today_practice_time) VALUES (?, ?, ?, ?)`,
                    [uuidv4(), userId, practiceTime, practiceTime]
                );
            }
        }

        res.json({ message: '进度已更新' });
    } catch (error) {
        console.error('Update progress error:', error);
        res.status(500).json({ error: '更新学习进度失败' });
    }
});

/**
 * GET /learning/statistics - 获取用户学习统计
 */
router.get('/statistics', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const stats = queryOne<any>('SELECT * FROM user_statistics WHERE user_id = ?', [userId]);

        if (!stats) {
            return res.json({
                totalWatchTime: 0, totalPracticeTime: 0, todayWatchTime: 0, todayPracticeTime: 0,
                totalVideosWatched: 0, totalSentencesCompleted: 0, totalWordsLearned: 0,
                totalAssessments: 0, currentStreak: 0, longestStreak: 0
            });
        }

        res.json({
            totalWatchTime: stats.total_watch_time,
            totalPracticeTime: stats.total_practice_time,
            todayWatchTime: stats.today_watch_time,
            todayPracticeTime: stats.today_practice_time,
            totalVideosWatched: stats.total_videos_watched,
            totalSentencesCompleted: stats.total_sentences_completed,
            totalWordsLearned: stats.total_words_learned,
            totalAssessments: stats.total_assessments,
            currentStreak: stats.current_streak,
            longestStreak: stats.longest_streak,
            lastStudyDate: stats.last_study_date
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: '获取学习统计失败' });
    }
});

/**
 * GET /learning/daily - 获取每日统计
 */
router.get('/daily', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { startDate, endDate, limit = '30' } = req.query;

        let sql = 'SELECT * FROM daily_statistics WHERE user_id = ?';
        const params: any[] = [userId];

        if (startDate) { sql += ' AND study_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND study_date <= ?'; params.push(endDate); }

        sql += ' ORDER BY study_date DESC LIMIT ?';
        params.push(parseInt(limit as string));

        const daily = query(sql, params);
        res.json(daily);
    } catch (error) {
        console.error('Get daily statistics error:', error);
        res.status(500).json({ error: '获取每日统计失败' });
    }
});

/**
 * POST /learning/statistics - 更新学习统计
 */
router.post('/statistics', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { watchTime, practiceTime, sentencesCompleted, wordsLearned, videosWatched } = req.body;

        const existing = queryOne('SELECT id FROM user_statistics WHERE user_id = ?', [userId]);

        if (existing) {
            const updates: string[] = [];
            const params: any[] = [];

            if (watchTime) { updates.push('total_watch_time = total_watch_time + ?'); params.push(watchTime); }
            if (practiceTime) { updates.push('total_practice_time = total_practice_time + ?'); params.push(practiceTime); }
            if (sentencesCompleted) { updates.push('total_sentences_completed = total_sentences_completed + ?'); params.push(sentencesCompleted); }
            if (wordsLearned) { updates.push('total_words_learned = total_words_learned + ?'); params.push(wordsLearned); }
            if (videosWatched) { updates.push('total_videos_watched = total_videos_watched + ?'); params.push(videosWatched); }

            if (updates.length > 0) {
                updates.push("last_study_date = date('now')");
                params.push(userId);
                update(`UPDATE user_statistics SET ${updates.join(', ')} WHERE user_id = ?`, params);
            }
        } else {
            run(
                `INSERT INTO user_statistics (id, user_id, last_study_date) VALUES (?, ?, date('now'))`,
                [uuidv4(), userId]
            );
        }

        res.json({ message: '统计已更新' });
    } catch (error) {
        console.error('Update statistics error:', error);
        res.status(500).json({ error: '更新学习统计失败' });
    }
});

/**
 * GET /learning/recent - 获取最近学习的视频
 */
router.get('/recent', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const limit = parseInt(req.query.limit as string) || 5;

        const recent = query(
            `SELECT lp.*, v.title, v.thumbnail_url, v.duration
       FROM learning_progress lp
       JOIN videos v ON lp.video_id = v.id
       WHERE lp.user_id = ?
       ORDER BY lp.updated_at DESC
       LIMIT ?`,
            [userId, limit]
        );

        res.json(recent);
    } catch (error) {
        console.error('Get recent learning error:', error);
        res.status(500).json({ error: '获取最近学习失败' });
    }
});

export default router;
