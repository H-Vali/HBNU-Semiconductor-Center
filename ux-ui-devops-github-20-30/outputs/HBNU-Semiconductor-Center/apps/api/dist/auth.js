import jwt from 'jsonwebtoken';
const jwtSecret = process.env.JWT_SECRET ?? 'local-dev-secret';
export function signToken(user) {
    return jwt.sign(user, jwtSecret, { expiresIn: '8h' });
}
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    try {
        req.user = jwt.verify(token, jwtSecret);
        next();
    }
    catch {
        return res.status(401).json({ message: 'Invalid or expired session' });
    }
}
export function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permission' });
        }
        next();
    };
}
