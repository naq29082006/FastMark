export const API_ENDPOINTS = {
  root: '/',
  profile: '/profile',
  restaurants: '/api/restaurants',
  restaurant: (id) => `/api/restaurants/${id}`,
  restaurantProducts: (id) => `/api/restaurants/${id}/products`,
  restaurantReviews: (id) => `/api/restaurants/${id}/reviews`,
  product: (id) => `/api/products/${id}`,
};
