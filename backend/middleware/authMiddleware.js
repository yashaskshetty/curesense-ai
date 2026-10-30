const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Route protection.
//
// Rewritten to fix two defects in the original control flow:
//
// 1. Double response. The old version handled the Bearer branch, then fell
//    through to a second `if (!token)` block. A request sending the header
//    `Authorization: Bearer` with no actual token left `token` undefined,
//    so a 401 was sent in the Bearer catch AND again in the fallback block,
//    producing ERR_HTTP_HEADERS_SENT. Every path here now returns.
//
// 2. Null user. `User.findById()` returns null for a token that is validly
//    signed but whose user has since been deleted. The old version called
//    next() anyway, so downstream routes dereferenced req.user._id and threw
//    a TypeError — surfacing as a confusing 500 instead of a 401.
//
// The token is read from `Authorization: Bearer <token>` or, for the frontend
// paths in services/api.js that use it, from the `x-auth-token` header.
const extractToken = (req) => {
    const header = req.headers.authorization;

    if (header && header.startsWith('Bearer')) {
        const [, bearerToken] = header.split(' ');
        if (bearerToken) {
            return bearerToken;
        }
    }

    return req.headers['x-auth-token'] || null;
};

const protect = async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user no longer exists' });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error(`Auth failed on ${req.method} ${req.originalUrl}: ${error.message}`);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

module.exports = { protect };
