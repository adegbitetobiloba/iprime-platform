// What the browser may see about a user. Never the password hash or the Google account id.
module.exports = (user) => {
  const { password, googleId, __v, ...safe } = user.toObject();
  return { ...safe, hasPassword: Boolean(password), googleLinked: Boolean(googleId) };
};
