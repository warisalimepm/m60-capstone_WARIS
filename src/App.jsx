import { useEffect, useMemo, useRef, useState } from 'react';
import initialProducts from './data/products';
import logoImage from './assets/logo.png';
import {
  MAX_PRODUCT_PRICE,
  clampQuantityToStock,
  getCartStockIssue,
  normalizePriceValue,
  readStoredCart,
} from './lib/cartStock';

const STORAGE_KEY = 'court-computer-demo';
const ADMIN_PASSWORD = 'i_ate_pasta';
const SECONDARY_ACTION_PASSWORD = 'LOL_CAT';
const DEFAULT_DARK_BACKGROUND = '#0b0f17';
const DEFAULT_BRIGHT_BACKGROUND = '#edf4ff';

const getCookieValue = (name) => {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));

  if (!match) return null;

  const [, rawValue] = match.split('=');

  try {
    return JSON.parse(decodeURIComponent(rawValue));
  } catch {
    return null;
  }
};

const setCookieValue = (name, value) => {
  const encoded = encodeURIComponent(JSON.stringify(value));
  document.cookie = `${name}=${encoded}; path=/; max-age=31536000; SameSite=Lax`;
};

const removeCookieValue = (name) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

const defaultProductImages = [
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1565610222536-ef125c59da2b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
];

const getRandomElectronicsImage = () =>
  defaultProductImages[Math.floor(Math.random() * defaultProductImages.length)];
const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const yearOptions = Array.from({ length: 10 }, (_, index) => 2026 + index);

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hexToRgb = (hex) => {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3 ? cleanHex.split('').map((value) => value + value).join('') : cleanHex;

  const numeric = Number.parseInt(normalized, 16);

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const blendHex = (hex, targetHex, weight = 0.5) => {
  const base = hexToRgb(hex);
  const target = hexToRgb(targetHex);

  const blendValue = (channel, targetChannel) =>
    Math.round(channel + (targetChannel - channel) * weight);

  return `rgb(${blendValue(base.r, target.r)}, ${blendValue(base.g, target.g)}, ${blendValue(base.b, target.b)})`;
};

const isLightColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.62;
};

const getDefaultBackgroundColor = (selectedTheme) =>
  selectedTheme === 'bright' ? DEFAULT_BRIGHT_BACKGROUND : DEFAULT_DARK_BACKGROUND;

const adjustColorForTheme = (hex, selectedTheme) => {
  const base = hexToRgb(hex || getDefaultBackgroundColor(selectedTheme));
  const amount = selectedTheme === 'bright' ? 0.14 : 0.14;

  const adjustChannel = (value) => {
    const nextValue = selectedTheme === 'bright'
      ? value + (255 - value) * amount
      : value * (1 - amount);

    return Math.min(255, Math.max(0, Math.round(nextValue)));
  };

  return `rgb(${adjustChannel(base.r)}, ${adjustChannel(base.g)}, ${adjustChannel(base.b)})`;
};

const getContrastTextColor = (hex) => (isLightColor(hex) ? '#0f172a' : '#f8fafc');

const levenshteinDistance = (first, second) => {
  const matrix = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0));

  for (let i = 0; i <= first.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= second.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= first.length; i += 1) {
    for (let j = 1; j <= second.length; j += 1) {
      const cost = first[i - 1] === second[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[first.length][second.length];
};

const fuzzyMatches = (value, query) => {
  if (!query) return true;

  const normalizedValue = normalizeText(value);
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return true;
  if (normalizedValue.includes(normalizedQuery)) return true;

  const maxAllowedDistance = Math.max(1, Math.floor(normalizedQuery.length * 0.25));
  return levenshteinDistance(normalizedValue, normalizedQuery) <= maxAllowedDistance;
};

function App() {
  const [view, setView] = useState('shop');
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [closingSideMenu, setClosingSideMenu] = useState(false);
  const [pageBackgroundColor, setPageBackgroundColor] = useState(() => {
    const savedColor = localStorage.getItem(`${STORAGE_KEY}-bg-color`);
    const savedTheme = localStorage.getItem(`${STORAGE_KEY}-theme`);
    const fallbackTheme = savedTheme === 'bright' ? 'bright' : 'dark';
    return savedColor || getDefaultBackgroundColor(fallbackTheme);
  });
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(`${STORAGE_KEY}-theme`);
    return savedTheme === 'bright' || savedTheme === 'dark' ? savedTheme : 'dark';
  });
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const baseProducts = !saved ? initialProducts : (() => {
      try {
        const parsed = JSON.parse(saved);
        return parsed.products || initialProducts;
      } catch {
        return initialProducts;
      }
    })();

    return baseProducts.map((product) => ({
      ...product,
      image: product.image || getRandomElectronicsImage(),
    }));
  });
  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return parsed.orders || [];
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-cart`);

    if (saved) {
      return readStoredCart(saved);
    }

    const savedCookieCart = getCookieValue(`${STORAGE_KEY}-cart`);
    return Array.isArray(savedCookieCart) ? readStoredCart(JSON.stringify(savedCookieCart)) : [];
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return parsed.users || [];
    } catch {
      return [];
    }
  });
  const [currentUserId, setCurrentUserId] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-current-user`);
    if (saved) return saved;

    const savedCookieUser = getCookieValue(`${STORAGE_KEY}-current-user`);
    return savedCookieUser || null;
  });
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showProfileLeaveConfirm, setShowProfileLeaveConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image: '',
  });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    captchaAnswer: '',
    createAdmin: false,
    adminPassword: '',
  });
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    profileImage: '',
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [captchaChallenge, setCaptchaChallenge] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-captcha`);

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [showCustomerItems, setShowCustomerItems] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showLeaveAdminConfirm, setShowLeaveAdminConfirm] = useState(false);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [closingCheckout, setClosingCheckout] = useState(false);
  const [closingAdminLogin, setClosingAdminLogin] = useState(false);
  const [closingLeaveAdminConfirm, setClosingLeaveAdminConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [secondaryActionPassword, setSecondaryActionPassword] = useState('');
  const [secondaryActionUnlocked, setSecondaryActionUnlocked] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [deletionNotice, setDeletionNotice] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-deletion-notice`);

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [timelineValue, setTimelineValue] = useState(30);
  const [timelineUnit, setTimelineUnit] = useState('days');
  const [notifications, setNotifications] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const profileInputRef = useRef(null);
  const [paymentForm, setPaymentForm] = useState({
    owner: '',
    cardNumber: '',
    month: 'January',
    year: '2026',
    cvv: '',
  });

  const [recentlyViewedIds, setRecentlyViewedIds] = useState([]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;

    return products.filter((product) => {
      const searchableText = `${product.name} ${product.description}`;
      return fuzzyMatches(searchableText, searchTerm);
    });
  }, [products, searchTerm]);

  const inventoryHealth = useMemo(() => {
    const lowStockCount = products.filter((product) => product.stock <= 3).length;

    if (lowStockCount === 0) {
      return { label: 'Stock healthy', tone: 'healthy' };
    }

    if (lowStockCount <= Math.max(2, Math.ceil(products.length * 0.2))) {
      return { label: 'Watchlist', tone: 'warning' };
    }

    return { label: 'Reorder soon', tone: 'danger' };
  }, [products]);

  const searchSummary = `${filteredProducts.length} item${filteredProducts.length === 1 ? '' : 's'} found`;

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((productId) => products.find((product) => product.id === productId))
        .filter(Boolean)
        .slice(0, 4),
    [products, recentlyViewedIds]
  );

  const moneyEarned = useMemo(
    () => orders.reduce((total, order) => total + Number(order.total || 0), 0),
    [orders]
  );

  const stockValue = useMemo(
    () => products.reduce((total, product) => total + product.price * product.stock, 0),
    [products]
  );

  const bestSellingProduct = useMemo(() => {
    const soldMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        soldMap[item.id] = (soldMap[item.id] || 0) + item.quantity;
      });
    });

    const topSeller = Object.entries(soldMap).sort(([, quantityA], [, quantityB]) => quantityB - quantityA)[0];

    if (!topSeller) return null;

    return products.find((product) => product.id === Number(topSeller[0])) || null;
  }, [orders, products]);

  const timelineSeries = useMemo(() => {
    const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
    const points = 18;
    const baseValue = Math.max(20, totalStock * 0.8);

    return Array.from({ length: points }, (_, index) => {
      const progress = index / (points - 1);
      const unitShift =
        timelineUnit === 'days'
          ? 1
          : timelineUnit === 'months'
            ? 30
            : 365;
      const timeLabelValue = Math.max(1, Math.round(progress * Math.max(1, timelineValue / unitShift) * unitShift));
      const trendWave = Math.sin(progress * Math.PI * 4 + timelineValue / 7) * 28;
      const trendLift = (timelineValue / Math.max(1, unitShift)) * 1.2;
      const value = Math.max(12, Math.round(baseValue * (0.48 + progress * 0.7) + trendWave + trendLift + index * 1.8));

      const label =
        timelineUnit === 'days'
          ? `${timeLabelValue}d`
          : timelineUnit === 'months'
            ? `${timeLabelValue}mo`
            : `${timeLabelValue}y`;

      return {
        label,
        value,
      };
    });
  }, [products, timelineUnit, timelineValue]);

  const currentUser = users.find((user) => user.id === currentUserId) || null;

  useEffect(() => {
    if (!currentUser) return;

    setProfileForm((currentForm) => ({
      ...currentForm,
      displayName: currentUser.displayName || currentUser.username || currentForm.displayName || '',
      profileImage: currentUser.profileImage || currentForm.profileImage || '',
    }));
  }, [currentUser]);

  const openProductEditor = (product = null) => {
    setEditingProductId(product?.id ?? null);
    setProductForm({
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price ?? '',
      stock: product?.stock ?? '',
      image: product?.image || '',
    });
    setShowProductEditor(true);
  };

  const saveProductEditor = () => {
    const nextName = productForm.name.trim();
    const nextDescription = productForm.description.trim();
    const rawPrice = Number(productForm.price);
    const parsedPrice = normalizePriceValue(productForm.price);
    const parsedStock = Number(productForm.stock);

    if (!nextName) {
      addNotification('error', 'Name required', 'Please add a product name before saving.');
      return;
    }

    if (!Number.isFinite(rawPrice) || rawPrice < 0) {
      addNotification('error', 'Price invalid', 'Please enter a valid price value.');
      return;
    }

    if (rawPrice > MAX_PRODUCT_PRICE) {
      addNotification('error', 'Price cap exceeded', `The item price must be at or below MOP ${MAX_PRODUCT_PRICE.toLocaleString()}.`);
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      addNotification('error', 'Stock invalid', 'Please enter a valid stock value.');
      return;
    }

    const finalImage = productForm.image.trim() || getRandomElectronicsImage();

    if (editingProductId) {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingProductId
            ? {
                ...product,
                name: nextName,
                description: nextDescription || product.description,
                price: parsedPrice,
                stock: parsedStock,
                image: finalImage,
              }
            : product
        )
      );
      addNotification('success', 'Product updated', 'The item was updated in the shop.');
    } else {
      const newId = Date.now();
      const newProduct = {
        id: newId,
        name: nextName,
        description: nextDescription || 'New product added by the admin.',
        price: parsedPrice,
        stock: parsedStock,
        image: finalImage,
      };

      setProducts((currentProducts) => [newProduct, ...currentProducts]);
      addNotification('success', 'Product added', 'The new item is now live in the shop.');
    }

    setShowProductEditor(false);
    setEditingProductId(null);
    setProductForm({ name: '', description: '', price: '', stock: '', image: '' });
  };

  const removeProduct = (productId) => {
    setProducts((currentProducts) => currentProducts.filter((product) => product.id !== productId));
    addNotification('info', 'Product removed', 'The item was removed from the shop.');
  };

  const customerOrders = useMemo(
    () => orders.filter((order) => order.userId === currentUserId),
    [orders, currentUserId]
  );

  useEffect(() => {
    const effectiveTheme = isLightColor(adjustColorForTheme(pageBackgroundColor, theme)) ? 'bright' : 'dark';
    document.body.dataset.theme = effectiveTheme;
    localStorage.setItem(`${STORAGE_KEY}-theme`, theme);
  }, [pageBackgroundColor, theme]);

  useEffect(() => {
    if (deletionNotice) {
      localStorage.setItem(`${STORAGE_KEY}-deletion-notice`, JSON.stringify(deletionNotice));
      return;
    }

    localStorage.removeItem(`${STORAGE_KEY}-deletion-notice`);
  }, [deletionNotice]);

  useEffect(() => {
    const baseColor = adjustColorForTheme(pageBackgroundColor || getDefaultBackgroundColor(theme), theme);
    const accentColor = blendHex(baseColor, '#ffffff', theme === 'bright' ? 0.18 : 0.08);
    const shadowColor = blendHex(baseColor, '#000000', theme === 'bright' ? 0.12 : 0.26);
    const textColor = getContrastTextColor(baseColor);
    const mutedTextColor = textColor === '#0f172a' ? '#475569' : '#cbd5e1';

    document.documentElement.style.setProperty('--page-bg', baseColor);
    document.documentElement.style.setProperty('--page-bg-alt', accentColor);
    document.documentElement.style.setProperty('--page-bg-shadow', shadowColor);
    document.documentElement.style.setProperty('--text', textColor);
    document.documentElement.style.setProperty('--text-strong', textColor);
    document.documentElement.style.setProperty('--muted', mutedTextColor);
    document.documentElement.style.setProperty('--panel-bg', textColor === '#0f172a' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.56)');
    document.documentElement.style.setProperty('--panel-border', textColor === '#0f172a' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.24)');
    document.body.style.background = `radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.18), transparent 22%), radial-gradient(circle at 75% 10%, rgba(168, 85, 247, 0.18), transparent 24%), radial-gradient(circle at 50% 100%, rgba(16, 185, 129, 0.12), transparent 24%), linear-gradient(180deg, ${baseColor} 0%, ${accentColor} 28%, ${shadowColor} 100%)`;
    document.body.style.transition = 'background 0.45s ease';
    document.body.style.color = textColor;
    localStorage.setItem(`${STORAGE_KEY}-bg-color`, pageBackgroundColor || getDefaultBackgroundColor(theme));
  }, [pageBackgroundColor, theme]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products,
        orders,
        users,
      })
    );
  }, [products, orders, users]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}-cart`, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setPageBackgroundColor(getDefaultBackgroundColor(theme));
      return;
    }

    const customBackground = localStorage.getItem(`${STORAGE_KEY}-last-custom-bg`);
    if (customBackground) {
      setPageBackgroundColor(customBackground);
    }
  }, [currentUserId, theme]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`${STORAGE_KEY}-current-user`, currentUserId);
      setCookieValue(`${STORAGE_KEY}-current-user`, currentUserId);
      return;
    }

    localStorage.removeItem(`${STORAGE_KEY}-current-user`);
    removeCookieValue(`${STORAGE_KEY}-current-user`);
  }, [currentUserId]);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}-cart`, JSON.stringify(cart));
      setCookieValue(`${STORAGE_KEY}-cart`, cart);
      return;
    }

    localStorage.removeItem(`${STORAGE_KEY}-cart`);
    removeCookieValue(`${STORAGE_KEY}-cart`);
  }, [cart]);

  useEffect(() => {
    if (captchaChallenge) {
      localStorage.setItem(`${STORAGE_KEY}-captcha`, JSON.stringify(captchaChallenge));
      return;
    }

    localStorage.removeItem(`${STORAGE_KEY}-captcha`);
  }, [captchaChallenge]);

  const addNotification = (type, title, message, duration = 3500, options = {}) => {
    const { visibleInShop = true } = options;
    const id = Date.now() + Math.random();

    setNotifications((currentNotifications) => [
      ...currentNotifications,
      {
        id,
        type,
        title,
        message,
        duration,
        visibleInShop,
        offsetX: 0,
        offsetY: 0,
      },
    ]);

    setTimeout(() => {
      setNotifications((currentNotifications) =>
        currentNotifications.filter((notification) => notification.id !== id)
      );
    }, duration);
  };

  const notifyStockLimit = (productName, availableStock) => {
    addNotification(
      'error',
      'Stock limit reached',
      `${productName} has only ${availableStock} left in stock.`
    );
  };

  const visibleNotifications = notifications.filter(
    (notification) => view !== 'shop' || notification.visibleInShop !== false
  );

  const removeNotification = (id) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== id)
    );
  };

  const getStageIndex = (stage) => {
    const stages = ['factory', 'packaging', 'delivering', 'arrived'];
    return stages.indexOf(stage) >= 0 ? stages.indexOf(stage) : 0;
  };

  const formatEta = (etaMinutes) => {
    if (!Number.isFinite(Number(etaMinutes)) || Number(etaMinutes) <= 0) {
      return 'Arriving soon';
    }

    const totalMinutes = Math.max(0, Number(etaMinutes));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  };

  const updateDeliveryTracking = (orderId, stage, etaMinutes) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order;

        const nextEta = Math.max(15, Number(etaMinutes) || 60);

        return {
          ...order,
          tracking: {
            ...order.tracking,
            stage,
            etaMinutes: nextEta,
            updatedAt: Date.now(),
          },
        };
      })
    );
  };

  const handleNotificationPointerDown = (id, event) => {
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    setDraggingId(id);
  };

  const handleNotificationPointerMove = (id, event) => {
    if (draggingId !== id) return;

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              offsetX: deltaX,
              offsetY: deltaY,
            }
          : notification
      )
    );
  };

  const handleNotificationPointerUp = (id) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              offsetX: 0,
              offsetY: 0,
            }
          : notification
      )
    );
    setDraggingId(null);
  };

  const trackRecentlyViewed = (productId) => {
    setRecentlyViewedIds((currentIds) => [productId, ...currentIds.filter((id) => id !== productId)].slice(0, 4));
  };

  const addToCart = (product) => {
    trackRecentlyViewed(product.id);

    if (product.stock <= 0) {
      addNotification('error', 'Out of stock', `${product.name} is not available right now.`);
      return;
    }

    const currentCartItem = cart.find((item) => item.id === product.id);
    const currentQuantity = currentCartItem?.quantity ?? 0;

    if (currentQuantity >= product.stock) {
      notifyStockLimit(product.name, product.stock);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);
      const nextQuantity = clampQuantityToStock(existingItem?.quantity ?? 0, product.stock, 1);

      if (existingItem) {
        return currentCart.map((item) => {
          if (item.id !== product.id) return item;

          if (existingItem.quantity >= product.stock) {
            notifyStockLimit(product.name, product.stock);
            return item;
          }

          return {
            ...item,
            quantity: nextQuantity,
          };
        });
      }

      return [
        ...currentCart,
        { id: product.id, name: product.name, price: product.price, quantity: 1 },
      ];
    });
  };

  const updateQuantity = (productId, change) => {
    const product = products.find((entry) => entry.id === productId);
    const productStock = product?.stock ?? 0;

    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== productId) return item;

          if (productStock <= 0) {
            notifyStockLimit(product?.name || 'This item', 0);
            return null;
          }

          if (change > 0 && item.quantity >= productStock) {
            notifyStockLimit(product?.name || 'This item', productStock);
            return item;
          }

          const nextQty = clampQuantityToStock(item.quantity, productStock, change);
          return nextQty <= 0 ? null : { ...item, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  };

  const formatCardNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const handlePaymentInput = (field, value) => {
    const nextValue = field === 'cardNumber' ? formatCardNumber(value) : value;

    setPaymentForm((currentForm) => ({
      ...currentForm,
      [field]: nextValue,
    }));
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;

    if (!currentUser) {
      addNotification('error', 'Login required', 'Please sign in before placing an order.');
      setShowCustomerAuth(true);
      setAuthMode('login');
      return;
    }

    const stockIssue = getCartStockIssue(cart, products);

    if (stockIssue.length > 0) {
      const brokenItem = stockIssue[0];
      const product = products.find((entry) => entry.id === brokenItem.id);

      notifyStockLimit(product ? product.name : 'An item', product ? product.stock : 0);

      setCart((currentCart) =>
        currentCart.map((item) => {
          if (item.id !== brokenItem.id) return item;
          const safeStock = product?.stock ?? 0;
          return { ...item, quantity: Math.min(item.quantity, safeStock) };
        })
      );
      return;
    }

    setIsCheckoutOpen(true);
  };

  const validateCheckoutForm = () => {
    const trimmedOwner = paymentForm.owner.trim();
    const issues = [];

    if (!trimmedOwner) {
      issues.push('Customer name is missing.');
    } else if (trimmedOwner.length < 2) {
      issues.push('Customer name is too short.');
    } else if (!/^[A-Za-zÀ-ÿ\s'-]+$/.test(trimmedOwner)) {
      issues.push('Customer name contains invalid characters.');
    }

    const digits = paymentForm.cardNumber.replace(/\D/g, '');

    if (!paymentForm.cardNumber.trim()) {
      issues.push('Card number is missing.');
    } else if (!/^\d[\d\s-]*$/.test(paymentForm.cardNumber.trim())) {
      issues.push('Card number contains letters or invalid symbols.');
    } else if (digits.length < 12 || digits.length > 19) {
      issues.push('Card number must be between 12 and 19 digits.');
    }

    if (!paymentForm.cvv.trim()) {
      issues.push('CVV is missing.');
    } else if (!/^\d{3,4}$/.test(paymentForm.cvv.trim())) {
      issues.push('CVV must be 3 or 4 digits.');
    }

    if (issues.length > 0) {
      addNotification('error', 'Payment form errors', issues.join(' • '));
      return false;
    }

    addNotification('success', 'Card accepted', 'Payment details look valid.');
    return true;
  };

  const confirmPayment = () => {
    if (!validateCheckoutForm()) return;

    const stockIssue = getCartStockIssue(cart, products);

    if (stockIssue.length > 0) {
      addNotification('error', 'Stock issue', 'One or more items in the cart exceeds the available stock.');
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const itemInCart = cart.find((item) => item.id === product.id);

        if (!itemInCart) return product;

        return {
          ...product,
          stock: Math.max(0, product.stock - itemInCart.quantity),
        };
      })
    );

    const etaMinutes = 120 + (cart.length * 25);
    const newOrder = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      userId: currentUser.id,
      customer: {
        owner: paymentForm.owner.trim(),
        cardNumber: paymentForm.cardNumber,
        expiry: `${paymentForm.month} ${paymentForm.year}`,
      },
      items: cart,
      total,
      tracking: {
        stage: 'factory',
        etaMinutes,
        updatedAt: Date.now(),
      },
    };

    setOrders((currentOrders) => [newOrder, ...currentOrders]);
    setCart([]);
    setPaymentForm({
      owner: '',
      cardNumber: '',
      month: 'January',
      year: '2026',
      cvv: '',
    });
    setIsCheckoutOpen(false);
    addNotification('success', 'Order placed', 'Your order was saved and stock was updated.', 3500, {
      visibleInShop: false,
    });
  };

  const changeStock = (productId, delta) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) return product;

        return {
          ...product,
          stock: Math.max(0, product.stock + delta),
        };
      })
    );
  };

  const updatePrice = (productId, newPrice) => {
    const safePrice = normalizePriceValue(newPrice);

    if (Number.isNaN(Number(newPrice))) return;

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, price: safePrice }
          : product
      )
    );
  };

  const resetDemoData = () => {
    setProducts(initialProducts);
    setOrders([]);
    setCart([]);
    setPaymentForm({
      owner: '',
      cardNumber: '',
      month: 'January',
      year: '2026',
      cvv: '',
    });
    setSearchTerm('');
    setView('shop');
    setShowOrders(true);
    addNotification('success', 'Demo reset', 'The shop has been restored to its default values.', 3500, {
      visibleInShop: false,
    });
  };

  const handleCustomerAuthChange = (field, value) => {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleProfileFormChange = (field, value) => {
    setProfileForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const hasProfileChanges = useMemo(() => {
    if (!currentUser) return false;

    const currentDisplayName = (currentUser.displayName || currentUser.username || '').trim();
    const currentImage = currentUser.profileImage || '';
    const nextDisplayName = (profileForm.displayName || currentUser.displayName || currentUser.username || '').trim();
    const nextImage = profileForm.profileImage || currentUser.profileImage || '';

    const changedProfile = currentDisplayName !== nextDisplayName || currentImage !== nextImage;
    const changedPassword = Boolean(profileForm.oldPassword || profileForm.newPassword || profileForm.confirmNewPassword);

    return changedProfile || changedPassword;
  }, [currentUser, profileForm]);

  const requestCloseSettings = () => {
    if (hasProfileChanges) {
      setShowProfileLeaveConfirm(true);
      return;
    }

    setShowAccountSettings(false);
  };

  const confirmLeaveSettings = () => {
    setShowProfileLeaveConfirm(false);
    setShowAccountSettings(false);
    if (currentUser) {
      setProfileForm({
        displayName: currentUser.displayName || currentUser.username || '',
        profileImage: currentUser.profileImage || '',
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  };

  const triggerProfileUpload = () => {
    profileInputRef.current?.click();
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((currentForm) => ({
        ...currentForm,
        profileImage: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveProfileSection = () => {
    if (!currentUser) return;

    const nextDisplayName = profileForm.displayName.trim() || currentUser.username;

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== currentUser.id) return user;

        return {
          ...user,
          displayName: nextDisplayName,
          profileImage: profileForm.profileImage || user.profileImage || '',
        };
      })
    );

    setProfileForm((currentForm) => ({
      ...currentForm,
      displayName: nextDisplayName,
      profileImage: profileForm.profileImage || currentUser.profileImage || '',
    }));
    addNotification('success', 'Profile saved', 'Your display name and photo were updated.');
  };

  const savePasswordSection = () => {
    if (!currentUser) return;

    const trimmedOldPassword = profileForm.oldPassword;
    const trimmedNewPassword = profileForm.newPassword.trim();

    if (!trimmedOldPassword) {
      addNotification('error', 'Old password required', 'Enter the current password before changing it.');
      return;
    }

    if (currentUser.password !== trimmedOldPassword) {
      addNotification('error', 'Wrong password', 'The old password does not match your current account password.');
      return;
    }

    if (!trimmedNewPassword) {
      addNotification('error', 'New password missing', 'Type a new password to update your account.');
      return;
    }

    if (trimmedNewPassword.length < 4) {
      addNotification('error', 'Weak password', 'The new password must be at least 4 characters long.');
      return;
    }

    if (trimmedNewPassword !== profileForm.confirmNewPassword) {
      addNotification('error', 'Passwords do not match', 'The new password and confirmation must match.');
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== currentUser.id) return user;
        return { ...user, password: trimmedNewPassword };
      })
    );

    setProfileForm((currentForm) => ({
      ...currentForm,
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    }));
    addNotification('success', 'Password updated', 'The account password was changed locally.');
  };

  const openCreateAccount = () => {
    setAuthMode('create');
    setShowCustomerAuth(true);
  };

  const generateCaptchaChallenge = () => {
    const first = Math.floor(Math.random() * 9) + 1;
    const second = Math.floor(Math.random() * 9) + 1;
    const operation = Math.random() > 0.5 ? '+' : '-';

    let answer = operation === '+' ? first + second : first - second;
    answer = Math.max(0, answer);

    setCaptchaChallenge({
      id: Date.now(),
      question: `${first} ${operation} ${second} = ?`,
      answer: String(answer),
    });
    setAuthForm((currentForm) => ({
      ...currentForm,
      captchaAnswer: '',
    }));
  };

  const handleCustomerAuthSubmit = () => {
    if (deletionNotice) {
      addNotification('info', 'Account removed', deletionNotice.message);
    }

    const normalizedUsername = authForm.username.trim();
    const normalizedEmail = authForm.email.trim().toLowerCase();
    const normalizedAddress = authForm.address.trim();

    if (authMode === 'create') {
      if (!normalizedUsername || !normalizedEmail || !authForm.password || !normalizedAddress) {
        addNotification('error', 'Missing details', 'Please complete all sign-up fields.');
        return;
      }

      if (authForm.password !== authForm.confirmPassword) {
        addNotification('error', 'Password mismatch', 'The confirmation password does not match.');
        return;
      }

      if (authForm.createAdmin) {
        if (authForm.adminPassword !== ADMIN_PASSWORD) {
          addNotification('error', 'Admin password required', 'Type the correct admin password to create an admin account.');
          return;
        }
      }

      if (!captchaChallenge) {
        generateCaptchaChallenge();
        addNotification('error', 'Captcha required', 'Please solve the captcha before creating the account.');
        return;
      }

      if ((authForm.captchaAnswer || '').trim() !== captchaChallenge.answer) {
        generateCaptchaChallenge();
        addNotification('error', 'Captcha failed', 'The captcha answer was incorrect. Please try again.');
        return;
      }

      if (users.some((user) => user.email === normalizedEmail || user.username === normalizedUsername)) {
        addNotification('error', 'User exists', 'That username or email is already registered.');
        return;
      }

      const newUser = {
        id: Date.now().toString(),
        username: normalizedUsername,
        email: normalizedEmail,
        password: authForm.password,
        address: normalizedAddress,
        role: authForm.createAdmin ? 'admin' : 'customer',
      };

      setUsers((currentUsers) => [newUser, ...currentUsers]);
      setCurrentUserId(newUser.id);
      setCaptchaChallenge(null);
      setShowCustomerAuth(false);
      setAuthForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        address: '',
        captchaAnswer: '',
        createAdmin: false,
        adminPassword: '',
      });
      setProfileForm((currentForm) => ({
        ...currentForm,
        displayName: normalizedUsername,
      }));

      if (newUser.role === 'admin') {
        setView('admin');
        setIsAdminUnlocked(true);
        addNotification('success', 'Admin account created', 'Admin access is unlocked for this account.');
        return;
      }

      addNotification('success', 'Account created', 'Your customer account is ready.');
      return;
    }

    if (!normalizedUsername && !normalizedEmail) {
      addNotification('error', 'Missing login', 'Enter your username or email.');
      return;
    }

    const matchedUser = users.find(
      (user) =>
        (user.username === normalizedUsername || user.email === normalizedEmail) &&
        user.password === authForm.password
    );

    if (!matchedUser) {
      addNotification('error', 'Login failed', 'Incorrect username/email or password.');
      return;
    }

    setCurrentUserId(matchedUser.id);
    setShowCustomerAuth(false);
    setAuthForm({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      address: '',
      captchaAnswer: '',
      createAdmin: false,
      adminPassword: '',
    });

    if (matchedUser.role === 'admin') {
      setView('admin');
      setIsAdminUnlocked(true);
      addNotification('success', 'Welcome back', `Signed in as admin ${matchedUser.username}.`);
      return;
    }

    addNotification('success', 'Welcome back', `Signed in as ${matchedUser.username}.`);
  };

  const handleLogout = () => {
    const restoredBackground = pageBackgroundColor || getDefaultBackgroundColor(theme);
    localStorage.setItem(`${STORAGE_KEY}-last-custom-bg`, restoredBackground);
    setPageBackgroundColor(getDefaultBackgroundColor(theme));
    setCurrentUserId(null);
    setIsAdminUnlocked(false);
    setSecondaryActionUnlocked(false);
    setShowDeleteUserConfirm(false);
    setPendingDeleteUser(null);
    setDeleteReason('');
    setSecondaryActionPassword('');
    setView('shop');
    setShowCustomerItems(false);
    addNotification('info', 'Logged out', 'You have been signed out.');
  };

  const deleteUser = (userId) => {
    const targetUser = users.find((user) => user.id === userId);

    if (!targetUser) return;

    setPendingDeleteUser({
      id: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
    });
    setDeleteReason('');
    setSecondaryActionPassword('');
    setShowDeleteUserConfirm(true);
  };

  const confirmDeleteUser = () => {
    if (!pendingDeleteUser) return;

    if (!secondaryActionUnlocked) {
      if (secondaryActionPassword !== SECONDARY_ACTION_PASSWORD) {
        addNotification('error', 'Secondary password required', 'The action password is incorrect.');
        return;
      }

      setSecondaryActionUnlocked(true);
    }

    const targetReason = deleteReason.trim() || 'No reason provided.';
    const targetUser = users.find((user) => user.id === pendingDeleteUser.id);

    if (!targetUser) {
      setShowDeleteUserConfirm(false);
      setPendingDeleteUser(null);
      setDeleteReason('');
      setSecondaryActionPassword('');
      return;
    }

    const nextMessage = `You got deleted! ${targetReason}`;
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== pendingDeleteUser.id));
    setOrders((currentOrders) => currentOrders.filter((order) => order.userId !== pendingDeleteUser.id));

    if (currentUserId === pendingDeleteUser.id) {
      setCurrentUserId(null);
      setCart([]);
      localStorage.removeItem(`${STORAGE_KEY}-cart`);
      removeCookieValue(`${STORAGE_KEY}-cart`);
    }

    setDeletionNotice({
      user: targetUser.username,
      reason: targetReason,
      message: nextMessage,
    });

    setShowDeleteUserConfirm(false);
    setPendingDeleteUser(null);
    setDeleteReason('');
    setSecondaryActionPassword('');
    setSecondaryActionUnlocked(false);
    addNotification('info', 'User removed', `${targetUser.username} was removed and their data was cleared.`);
  };

  const openAdmin = () => {
    setClosingAdminLogin(false);
    setClosingLeaveAdminConfirm(false);
    setShowLeaveAdminConfirm(false);
    setShowAdminLogin(true);
    setAdminPassword('');
  };

  const safeCloseAdminLogin = () => {
    if (closingAdminLogin) return;
    setClosingAdminLogin(true);
    setTimeout(() => {
      setShowAdminLogin(false);
      setClosingAdminLogin(false);
    }, 280);
  };

  const safeCloseLeaveAdmin = () => {
    if (closingLeaveAdminConfirm) return;
    setClosingLeaveAdminConfirm(true);
    setTimeout(() => {
      setShowLeaveAdminConfirm(false);
      setClosingLeaveAdminConfirm(false);
    }, 280);
  };

  const safeCloseCheckout = () => {
    if (closingCheckout) return;
    setClosingCheckout(true);
    setTimeout(() => {
      setIsCheckoutOpen(false);
      setClosingCheckout(false);
    }, 280);
  };

  const handleAdminPasswordSubmit = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminUnlocked(true);
      setSecondaryActionUnlocked(false);
      setSecondaryActionPassword('');
      setView('admin');
      setShowAdminLogin(false);
      setAdminPassword('');
      addNotification('success', 'Admin unlocked', 'You can now manage stock and orders.', 3500, {
        visibleInShop: false,
      });
      return;
    }

    addNotification('error', 'Invalid admin password', 'The password was incorrect.');
    setAdminPassword('');
  };

  const handleLeaveAdmin = () => {
    setClosingLeaveAdminConfirm(false);
    setShowLeaveAdminConfirm(true);
  };

  const confirmLeaveAdmin = () => {
    setView('shop');
    setShowAdminLogin(false);
    setClosingAdminLogin(false);
    safeCloseLeaveAdmin();
    addNotification('info', 'Admin left', 'You returned to the customer storefront.', 3500, {
      visibleInShop: false,
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const reviewCards = useMemo(
    () =>
      products.slice(0, 3).map((product, index) => ({
        id: product.id,
        title: product.name,
        summary:
          index === 0
            ? 'A flagship performer that balances raw power with excellent cooling and upgrade flexibility.'
            : index === 1
              ? 'Great for creators and multitaskers who need speed, clean thermals, and long-term value.'
              : 'A smart pick for compact setups that still demand premium build quality and stable performance.',
        image: product.image,
        price: product.price,
      })),
    [products]
  );

  const formatMaskedCard = (cardNumber) => {
    if (!cardNumber) return 'N/A';

    const digits = cardNumber.replace(/\s+/g, '');
    const lastFour = digits.slice(-4);

    return `•••• ${lastFour}`;
  };

  return (
    <main className="app-shell">
      {isLoading && (
        <div className="loading-overlay" aria-live="polite" aria-busy="true">
          <div className="loading-spinner" aria-label="Loading" />
        </div>
      )}

      {view === 'shop' && (
        <header className="topbar">
          <div className="brand-stack">
            <div className="brand-mark" aria-label="Court Computer Hardware logo">
              <img src={logoImage} alt="Court Computer Hardware logo" />
            </div>

            <button
              type="button"
              className="menu-toggle-button"
              aria-label="Open menu"
              onClick={() => setShowSideMenu(true)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <div className="nav-actions">
            <div className="nav-main-cluster">
              <button
                type="button"
                className="nav-button active"
                onClick={() => setView('shop')}
              >
                All Items
              </button>

              <div className="search-box">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                />
                <button type="button">Search</button>
              </div>

              <div className="shop-summary-row">
                <span className="search-summary-pill">{searchSummary}</span>
                <span className={`stock-health-pill ${inventoryHealth.tone}`}>{inventoryHealth.label}</span>
              </div>

              <div className="theme-switcher-group">
                <small className="theme-switcher-hint">Background colour is chosen in Settings</small>
                <div className="theme-switcher" role="tablist" aria-label="Theme selector">
                  <button
                    type="button"
                    className={theme === 'dark' ? 'theme-option active' : 'theme-option'}
                    onClick={() => setTheme('dark')}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    className={theme === 'bright' ? 'theme-option active' : 'theme-option'}
                    onClick={() => setTheme('bright')}
                  >
                    Bright
                  </button>
                </div>
              </div>
            </div>

            <div className="account-cluster">
              {currentUser ? (
                <>
                  <button type="button" className="customer-status-button" onClick={() => setShowCustomerItems(true)}>
                    My Items
                  </button>
                  <button type="button" className="customer-status-button" onClick={() => setShowAccountSettings(true)}>
                    Account
                  </button>
                  <button
                    type="button"
                    className="account-avatar-button"
                    onClick={() => setShowAccountSettings(true)}
                    aria-label={currentUser.displayName || currentUser.username}
                    title={currentUser.displayName || currentUser.username}
                  >
                    {currentUser.profileImage ? (
                      <img src={currentUser.profileImage} alt={currentUser.displayName || currentUser.username} />
                    ) : (
                      <span>{(currentUser.displayName || currentUser.username || 'U').slice(0, 1).toUpperCase()}</span>
                    )}
                    <span className="avatar-tooltip">{currentUser.displayName || currentUser.username}</span>
                  </button>
                  <button type="button" className="owner-login-button" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="owner-login-button"
                  onClick={() => {
                    setAuthMode('login');
                    setShowCustomerAuth(true);
                  }}
                >
                  User Login
                </button>
              )}

              <button
                type="button"
                className="owner-login-button admin-button"
                onClick={openAdmin}
              >
                Admin Login
              </button>
            </div>

            {view === 'admin' && isAdminUnlocked && (
              <button type="button" className="leave-admin-button" onClick={handleLeaveAdmin}>
                Leave Admin
              </button>
            )}
          </div>
        </header>
      )}

      {view === 'admin' && (
        <header className="admin-topbar">
          <div className="admin-brand-mark" aria-label="Court Computer Hardware logo">
            <img src={logoImage} alt="Court Computer Hardware logo" />
          </div>
        </header>
      )}

      <div
        className="admin-secret-zone"
        onDoubleClick={openAdmin}
        aria-label="Hidden admin access zone"
        title="Double click to open admin"
      />

      {showCustomerAuth && (
        <div className="customer-auth-overlay" onClick={() => setShowCustomerAuth(false)}>
          <div className={`customer-auth-card ${authMode === 'create' ? 'create-mode' : 'login-mode'}`} onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h3>
              <button type="button" className="notification-close" onClick={() => setShowCustomerAuth(false)}>
                ×
              </button>
            </div>

            {deletionNotice && (
              <div className="deletion-notice-banner">
                <strong>You got deleted!</strong>
                <span>{deletionNotice.message}</span>
              </div>
            )}

            <div className="customer-auth-form">
              {authMode === 'create' && (
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    value={authForm.username}
                    onChange={(event) => handleCustomerAuthChange('username', event.target.value)}
                  />
                </label>
              )}

              {authMode === 'create' && (
                <label className="admin-toggle-row">
                  <input
                    type="checkbox"
                    checked={authForm.createAdmin}
                    onChange={(event) => handleCustomerAuthChange('createAdmin', event.target.checked)}
                  />
                  <span>Create admin account</span>
                </label>
              )}

              {authMode === 'create' && authForm.createAdmin && (
                <label>
                  <span>Admin password</span>
                  <input
                    type="password"
                    value={authForm.adminPassword}
                    onChange={(event) => handleCustomerAuthChange('adminPassword', event.target.value)}
                    placeholder="Enter admin password"
                  />
                </label>
              )}

              <label>
                <span>{authMode === 'create' ? 'Email' : 'Username / Email'}</span>
                <input
                  type="text"
                  value={authMode === 'create' ? authForm.email : authForm.username || authForm.email}
                  onChange={(event) =>
                    handleCustomerAuthChange(authMode === 'create' ? 'email' : 'username', event.target.value)
                  }
                />
              </label>

              {authMode === 'create' && (
                <div className="captcha-box">
                  <button type="button" className="mini-action-button" onClick={generateCaptchaChallenge}>
                    Refresh captcha
                  </button>

                  {captchaChallenge ? (
                    <div className="captcha-question-box">
                      <span>reCAPTCHA</span>
                      <strong>{captchaChallenge.question}</strong>
                    </div>
                  ) : (
                    <p className="verification-note">Generate a captcha to continue.</p>
                  )}
                </div>
              )}

              {authMode === 'create' && (
                <label>
                  <span>Solve the captcha</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={authForm.captchaAnswer}
                    onChange={(event) => handleCustomerAuthChange('captchaAnswer', event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
              )}

              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => handleCustomerAuthChange('password', event.target.value)}
                />
              </label>

              {authMode === 'create' && (
                <>
                  <label>
                    <span>Repeat password</span>
                    <input
                      type="password"
                      value={authForm.confirmPassword}
                      onChange={(event) => handleCustomerAuthChange('confirmPassword', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Home address</span>
                    <input
                      type="text"
                      value={authForm.address}
                      onChange={(event) => handleCustomerAuthChange('address', event.target.value)}
                    />
                  </label>
                </>
              )}

              <button type="button" className="customer-auth-submit" onClick={handleCustomerAuthSubmit}>
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <button
                type="button"
                className="text-link-button"
                onClick={() => {
                  const nextMode = authMode === 'login' ? 'create' : 'login';
                  setAuthMode(nextMode);
                  if (nextMode === 'create') {
                    generateCaptchaChallenge();
                  }
                }}
              >
                {authMode === 'login' ? 'No Account? Create One!' : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccountSettings && currentUser && (
        <div className="customer-items-overlay" onClick={requestCloseSettings}>
          <div className="customer-items-modal settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>Account Settings</h3>
              <button type="button" className="notification-close" onClick={requestCloseSettings}>
                ×
              </button>
            </div>

            <div className="settings-form">
              <div className="settings-section">
                <div className="settings-section-header">
                  <h4>Profile</h4>
                  <button type="button" className="mini-action-button" onClick={saveProfileSection}>Save profile</button>
                </div>

                <label className="profile-image-field">
                  <span>Profile picture</span>
                  <div
                    className="profile-preview-box"
                    role="button"
                    tabIndex={0}
                    onClick={triggerProfileUpload}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        triggerProfileUpload();
                      }
                    }}
                  >
                    {profileForm.profileImage || currentUser.profileImage ? (
                      <img src={profileForm.profileImage || currentUser.profileImage} alt="Profile preview" />
                    ) : (
                      <div className="profile-placeholder">{(currentUser.displayName || currentUser.username || 'U').slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>
                  <button type="button" className="choose-file-button" onClick={triggerProfileUpload}>
                    Choose File
                  </button>
                  <input ref={profileInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleProfileImageUpload} />
                </label>

                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={profileForm.displayName || currentUser.displayName || currentUser.username}
                    onChange={(event) => handleProfileFormChange('displayName', event.target.value)}
                  />
                </label>
              </div>

              <div className="settings-section">
                <div className="settings-section-header">
                  <h4>Security</h4>
                  <button type="button" className="mini-action-button" onClick={savePasswordSection}>Save password</button>
                </div>

                <label>
                  <span>Old password</span>
                  <input
                    type="password"
                    value={profileForm.oldPassword}
                    onChange={(event) => handleProfileFormChange('oldPassword', event.target.value)}
                  />
                </label>

                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(event) => handleProfileFormChange('newPassword', event.target.value)}
                  />
                </label>

                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={profileForm.confirmNewPassword}
                    onChange={(event) => handleProfileFormChange('confirmNewPassword', event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileLeaveConfirm && (
        <div className="customer-items-overlay" onClick={() => setShowProfileLeaveConfirm(false)}>
          <div className="customer-items-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>Leave without saving?</h3>
              <button type="button" className="notification-close" onClick={() => setShowProfileLeaveConfirm(false)}>
                ×
              </button>
            </div>
            <p className="confirm-copy">Unsaved changes may be lost.</p>
            <div className="admin-login-actions">
              <button type="button" className="secondary-button" onClick={() => setShowProfileLeaveConfirm(false)}>
                Stay
              </button>
              <button type="button" className="primary-button" onClick={confirmLeaveSettings}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductEditor && (
        <div className="customer-items-overlay" onClick={() => setShowProductEditor(false)}>
          <div className="customer-items-modal settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>{editingProductId ? 'Edit product' : 'Add product'}</h3>
              <button type="button" className="notification-close" onClick={() => setShowProductEditor(false)}>
                ×
              </button>
            </div>

            <div className="settings-form">
              <label>
                <span>Product name</span>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                />
              </label>

              <label>
                <span>Image URL</span>
                <input
                  type="url"
                  value={productForm.image}
                  onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, image: event.target.value }))}
                  placeholder="Leave blank to use the default stock image"
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={productForm.description}
                  onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
                  rows="3"
                />
              </label>

              <div className="two-column-grid">
                <label>
                  <span>Price</span>
                  <input
                    type="number"
                    min="0"
                    max={MAX_PRODUCT_PRICE}
                    step="1"
                    value={productForm.price}
                    onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, price: event.target.value }))}
                  />
                </label>

                <label>
                  <span>Stock</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, stock: event.target.value }))}
                  />
                </label>
              </div>

              <button type="button" className="customer-auth-submit" onClick={saveProductEditor}>
                {editingProductId ? 'Save item' : 'Add item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomerItems && currentUser && (
        <div className="customer-items-overlay" onClick={() => setShowCustomerItems(false)}>
          <div className="customer-items-modal" onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>Your Items</h3>
              <button type="button" className="notification-close" onClick={() => setShowCustomerItems(false)}>
                ×
              </button>
            </div>

            {customerOrders.length === 0 ? (
              <p className="no-orders">No purchases yet.</p>
            ) : (
              <div className="customer-items-list">
                {customerOrders.map((order) => (
                  <article key={order.id} className="customer-order-card">
                    <div className="order-card-header">
                      <strong>{order.date}</strong>
                      <span>MOP {order.total.toLocaleString()}</span>
                    </div>

                    <div className="tracking-stage-row">
                      {['factory', 'packaging', 'delivering', 'arrived'].map((stage) => (
                        <span
                          key={stage}
                          className={getStageIndex(order.tracking?.stage || 'factory') >= getStageIndex(stage) ? 'tracking-step active' : 'tracking-step'}
                        >
                          {stage}
                        </span>
                      ))}
                    </div>

                    <div className="tracking-progress">
                      <span style={{ width: `${((getStageIndex(order.tracking?.stage || 'factory') + 1) / 4) * 100}%` }} />
                    </div>

                    <p className="delivery-summary">
                      Status: {order.tracking?.stage || 'factory'} • ETA {formatEta(order.tracking?.etaMinutes || 120)}
                    </p>

                    <ul className="order-items">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.id}`}>
                          {item.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSideMenu && (
        <div
          className={`side-menu-overlay ${closingSideMenu ? 'closing' : ''}`}
          onClick={() => {
            if (closingSideMenu) return;
            setClosingSideMenu(true);
            setTimeout(() => {
              setShowSideMenu(false);
              setClosingSideMenu(false);
            }, 260);
          }}
        >
          <aside
            className={`side-menu-panel ${closingSideMenu ? 'closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="side-menu-header">
              <div>
                <span className="side-menu-kicker">Menu</span>
                <h3>Quick access</h3>
              </div>
              <button
                type="button"
                className="side-menu-close"
                onClick={() => {
                  if (closingSideMenu) return;
                  setClosingSideMenu(true);
                  setTimeout(() => {
                    setShowSideMenu(false);
                    setClosingSideMenu(false);
                  }, 260);
                }}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="side-menu-actions">
              <button
                type="button"
                className="side-menu-item"
                onClick={() => {
                  setView('shop');
                  setClosingSideMenu(true);
                  setTimeout(() => {
                    setShowSideMenu(false);
                    setClosingSideMenu(false);
                  }, 260);
                }}
              >
                Shop
              </button>

              <button
                type="button"
                className="side-menu-item"
                onClick={() => {
                  setShowAccountSettings(true);
                  setClosingSideMenu(true);
                  setTimeout(() => {
                    setShowSideMenu(false);
                    setClosingSideMenu(false);
                  }, 260);
                }}
              >
                Account Settings
              </button>

              <button
                type="button"
                className="side-menu-item"
                onClick={() => {
                  setView('reviews');
                  setClosingSideMenu(true);
                  setTimeout(() => {
                    setShowSideMenu(false);
                    setClosingSideMenu(false);
                  }, 260);
                }}
              >
                Latest Tech Reviews
              </button>
            </div>

            <div className="side-menu-settings-block">
              <span className="side-menu-kicker">Background</span>
              <div className="background-picker-row">
                <span>Pick page colour</span>
                <button
                  type="button"
                  className="background-picker-trigger"
                  onClick={() => document.getElementById('page-background-color-picker')?.click()}
                >
                  Click me
                </button>
                <input
                  id="page-background-color-picker"
                  type="color"
                  value={pageBackgroundColor}
                  onChange={(event) => {
                    const nextColor = event.target.value;
                    localStorage.setItem(`${STORAGE_KEY}-last-custom-bg`, nextColor);
                    setPageBackgroundColor(nextColor);
                  }}
                  aria-label="Pick page colour"
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {view === 'shop' ? (
        <div className="content-layout">
          <section>
            <div className="shop-toolbar">
              <button type="button" className="nav-button active" onClick={() => setSearchTerm('')}>
                All Items
              </button>
            </div>

            {recentlyViewedProducts.length > 0 && (
              <div className="recent-view-row">
                <span className="recent-view-label">Recently viewed</span>
                <div className="recent-view-list">
                  {recentlyViewedProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="recent-view-item"
                      onClick={() => {
                        setSearchTerm(product.name);
                        trackRecentlyViewed(product.id);
                      }}
                    >
                      <img src={product.image} alt={product.name} />
                      <span>{product.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="product-card"
                  onClick={() => trackRecentlyViewed(product.id)}
                >
                  <img src={product.image} alt={product.name} />

                  <div className="product-info">
                    <h2>{product.name}</h2>
                    <p className="description">{product.description}</p>

                    <div className="meta-row">
                      <span className="price">MOP {product.price.toLocaleString()}</span>
                      <span className={`stock ${product.stock === 0 ? 'out' : ''}`}>
                        {product.stock === 0 ? 'Out of Stock' : `${product.stock} in stock`}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="add-button"
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                    >
                      {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="cart-panel">
            <h3>Cart</h3>

            {cart.length === 0 ? (
              <p className="empty-cart">Your cart is empty.</p>
            ) : (
              <ul className="cart-list">
                {cart.map((item) => (
                  <li key={item.id} className="cart-item">
                    <div className="cart-item-main">
                      <strong>{item.name}</strong>
                      <span>MOP {(item.price * item.quantity).toLocaleString()}</span>
                    </div>

                    <div className="cart-controls">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)}>
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={(products.find((product) => product.id === item.id)?.stock ?? 0) <= item.quantity}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="cart-total">
              <span>Total</span>
              <strong>MOP {cartTotal.toLocaleString()}</strong>
            </div>

            <button
              type="button"
              className="order-button"
              onClick={handlePlaceOrder}
              disabled={cart.length === 0}
            >
              Place Order
            </button>
          </aside>
        </div>
      ) : view === 'reviews' ? (
        <section className="reviews-page">
          <div className="reviews-header">
            <div>
              <span className="side-menu-kicker">Latest</span>
              <h2>New tech reviews</h2>
            </div>
            <button type="button" className="mini-action-button" onClick={() => setView('shop')}>
              Back to shop
            </button>
          </div>

          <div className="review-grid">
            {reviewCards.map((review) => (
              <article key={review.id} className="review-card">
                <img src={review.image} alt={review.title} />
                <div className="review-body">
                  <span className="review-badge">Tech Review</span>
                  <h3>{review.title}</h3>
                  <p>{review.summary}</p>
                  <div className="review-footer">
                    <span>MOP {review.price.toLocaleString()}</span>
                    <button type="button" className="mini-action-button" onClick={() => setView('shop')}>
                      View item
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="admin-panel">
          <div className="admin-header-row">
            <h2>Stock Management</h2>
            <div className="admin-actions">
              <button type="button" className="mini-action-button" onClick={() => openProductEditor()}>
                Add item
              </button>
              <button type="button" className="leave-admin-button compact" onClick={handleLeaveAdmin}>
                Leave Admin
              </button>
              <button type="button" className="reset-button" onClick={resetDemoData}>
                Reset Demo Data
              </button>
            </div>
          </div>

          <div className="stock-spotlight glass-panel">
            <div className="stock-spotlight-header">
              <div>
                <span className="chip">Inventory pulse</span>
                <h3>Market strong</h3>
              </div>
              <span className="trend positive">+12.4%</span>
            </div>

            <div className="mini-chart" aria-label="Timeline stock chart">
              {timelineSeries.map((point, index) => (
                <div key={`${point.label}-${index}`} className="chart-column">
                  <span className="chart-value">{point.value}</span>
                  <span
                    className="chart-bar"
                    style={{ height: `${Math.min(100, Math.max(24, (point.value / Math.max(1, timelineSeries.at(-1)?.value ?? 1)) * 100))}%` }}
                  />
                  <span className="chart-label">{point.label}</span>
                </div>
              ))}
            </div>

            <div className="stock-readout">
              <div>
                <span>Best seller</span>
                <strong>{bestSellingProduct?.name || 'No sales yet'}</strong>
              </div>
              <div>
                <span>Stock value</span>
                <strong>MOP {stockValue.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <h4>Money earned</h4>
              <strong>MOP {moneyEarned.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <h4>Orders</h4>
              <strong>{orders.length}</strong>
            </div>
            <div className="stat-card">
              <h4>Stock value</h4>
              <strong>MOP {stockValue.toLocaleString()}</strong>
            </div>
          </div>

          <div className="timeline-panel">
            <div className="timeline-label-row">
              <span>Timeline</span>
              <strong>
                Every {timelineValue} {timelineUnit}
              </strong>
            </div>

            <input
              type="range"
              min="1"
              max="365"
              value={timelineValue}
              onChange={(event) => setTimelineValue(Number(event.target.value))}
              className="timeline-slider"
            />

            <div className="timeline-unit-row">
              <span>Update every</span>
              <select value={timelineUnit} onChange={(event) => setTimelineUnit(event.target.value)}>
                <option value="days">days</option>
                <option value="months">months</option>
                <option value="years">years</option>
              </select>
            </div>
          </div>

          <table className="stock-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-cell">
                      <img src={product.image || defaultProductImages[product.id % defaultProductImages.length]} alt={product.name} />
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={MAX_PRODUCT_PRICE}
                      step="1"
                      value={product.price}
                      onChange={(event) => updatePrice(product.id, event.target.value)}
                    />
                  </td>
                  <td>
                    <div className="stock-controls-admin">
                      <button type="button" onClick={() => changeStock(product.id, -1)}>
                        −
                      </button>
                      <span>{product.stock}</span>
                      <button type="button" onClick={() => changeStock(product.id, 1)}>
                        +
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="product-action-row">
                      <button type="button" className="mini-action-button" onClick={() => openProductEditor(product)}>
                        Edit
                      </button>
                      <button type="button" className="delete-user-button compact" onClick={() => removeProduct(product.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="user-manager-panel">
            <div className="orders-header-row">
              <h3>Customer / User Manager</h3>
            </div>

            {users.length === 0 ? (
              <p className="no-orders">No customer accounts yet.</p>
            ) : (
              <div className="user-manager-list">
                {users.map((user) => {
                  const userOrders = orders.filter((order) => order.userId === user.id);

                  return (
                    <article key={user.id} className="user-manager-card">
                      <div className="user-manager-header">
                        <div>
                          <strong>{user.username}</strong>
                          <p>{user.email}</p>
                        </div>
                        <button type="button" className="delete-user-button" onClick={() => deleteUser(user.id)}>
                          Delete User
                        </button>
                      </div>

                      <div className="user-detail-grid">
                        <div>
                          <span className="order-label">Password</span>
                          <p>{user.password}</p>
                        </div>
                        <div>
                          <span className="order-label">Address</span>
                          <p>{user.address}</p>
                        </div>
                      </div>

                      <div className="delivery-manager-list">
                        {userOrders.length === 0 ? (
                          <p className="no-orders">No deliveries for this user.</p>
                        ) : (
                          userOrders.map((order) => (
                            <div key={order.id} className="delivery-manager-card">
                              <div className="order-card-header">
                                <strong>{order.date}</strong>
                                <span>MOP {order.total.toLocaleString()}</span>
                              </div>

                              <ul className="order-items">
                                {order.items.map((item) => (
                                  <li key={`${order.id}-${item.id}`}>
                                    {item.name} × {item.quantity}
                                  </li>
                                ))}
                              </ul>

                              <div className="delivery-controls-row">
                                <label>
                                  <span>Stage</span>
                                  <select
                                    value={order.tracking?.stage || 'factory'}
                                    onChange={(event) =>
                                      updateDeliveryTracking(
                                        order.id,
                                        event.target.value,
                                        order.tracking?.etaMinutes || 120
                                      )
                                    }
                                  >
                                    <option value="factory">Factory</option>
                                    <option value="packaging">Packaging</option>
                                    <option value="delivering">Delivering</option>
                                    <option value="arrived">Arrived</option>
                                  </select>
                                </label>

                                <label>
                                  <span>ETA minutes</span>
                                  <input
                                    type="number"
                                    min="15"
                                    step="15"
                                    value={order.tracking?.etaMinutes || 120}
                                    onChange={(event) =>
                                      updateDeliveryTracking(
                                        order.id,
                                        order.tracking?.stage || 'factory',
                                        Number(event.target.value)
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="orders-box">
            <div className="orders-header-row">
              <h3>Order History</h3>
              <button
                type="button"
                className="toggle-orders-button"
                onClick={() => setShowOrders((current) => !current)}
              >
                {showOrders ? 'Hide Orders' : 'Show Orders'}
              </button>
            </div>

            {showOrders && (
              <>
                {orders.length === 0 ? (
                  <p className="no-orders">No orders yet.</p>
                ) : (
                  <div className="order-list">
                    {orders.map((order) => (
                      <article key={order.id} className="order-card">
                        <div className="order-card-header">
                          <strong>{order.date}</strong>
                          <span>MOP {order.total.toLocaleString()}</span>
                        </div>

                        <div className="order-customer">
                          <p>
                            <span className="order-label">Customer:</span>{' '}
                            {order.customer?.owner || 'Unknown'}
                          </p>
                          <p>
                            <span className="order-label">Card:</span>{' '}
                            {formatMaskedCard(order.customer?.cardNumber)}
                          </p>
                          <p>
                            <span className="order-label">Expiry:</span>{' '}
                            {order.customer?.expiry || 'N/A'}
                          </p>
                        </div>

                        <ul className="order-items">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.id}`}>
                              {item.name} × {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {isCheckoutOpen && (
        <div
          className={`checkout-overlay ${closingCheckout ? 'closing' : ''}`}
          onClick={safeCloseCheckout}
        >
          <div
            className={`checkout-card ${closingCheckout ? 'closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Confirm Purchase</h2>

            <div className="checkout-row">
              <label>
                <span>Owner</span>
                <input
                  type="text"
                  value={paymentForm.owner}
                  onChange={(event) => handlePaymentInput('owner', event.target.value)}
                  placeholder="Full name"
                />
              </label>

              <label>
                <span>CVV</span>
                <input
                  type="password"
                  maxLength={4}
                  value={paymentForm.cvv}
                  onChange={(event) => handlePaymentInput('cvv', event.target.value)}
                  placeholder="123"
                />
              </label>
            </div>

            <label>
              <span>Card Number</span>
              <input
                type="text"
                value={paymentForm.cardNumber}
                onChange={(event) => handlePaymentInput('cardNumber', event.target.value)}
                placeholder="1234 5678 9012 3456"
                inputMode="numeric"
              />
            </label>

            <div className="checkout-row expiry-row">
              <label>
                <span>Expiration Date</span>
                <div className="expiry-inputs">
                  <select
                    value={paymentForm.month}
                    onChange={(event) => handlePaymentInput('month', event.target.value)}
                  >
                    {monthOptions.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>

                  <select
                    value={paymentForm.year}
                    onChange={(event) => handlePaymentInput('year', event.target.value)}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <div className="card-brand-row" aria-label="Accepted card types">
                <span className="brand visa">VISA</span>
                <span className="brand mastercard">MasterCard</span>
                <span className="brand amex">AMEX</span>
              </div>
            </div>

            <div className="checkout-actions">
              <button
                type="button"
                className="checkout-cancel"
                onClick={safeCloseCheckout}
              >
                Cancel
              </button>

              <button type="button" className="checkout-confirm" onClick={confirmPayment}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteUserConfirm && pendingDeleteUser && (
        <div className="customer-items-overlay" onClick={() => setShowDeleteUserConfirm(false)}>
          <div className="customer-items-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="customer-auth-header">
              <h3>Delete {pendingDeleteUser.username}?</h3>
              <button type="button" className="notification-close" onClick={() => setShowDeleteUserConfirm(false)}>
                ×
              </button>
            </div>

            <div className="settings-form">
              <label>
                <span>Reason for deletion</span>
                <textarea
                  rows="3"
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="Enter the reason for removing this user"
                />
              </label>

              <label>
                <span>Secondary action password</span>
                <input
                  type="password"
                  value={secondaryActionPassword}
                  onChange={(event) => setSecondaryActionPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </label>
            </div>

            <div className="admin-login-actions">
              <button type="button" className="secondary-button" onClick={() => setShowDeleteUserConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={confirmDeleteUser}>
                Delete user
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div
          className={`admin-login-overlay ${closingAdminLogin ? 'closing' : ''}`}
          onClick={safeCloseAdminLogin}
        >
          <div
            className={`admin-login-modal ${closingAdminLogin ? 'closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Admin Access</h3>
            <p>Enter the admin password to unlock management tools.</p>

            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Password"
            />

            <div className="admin-login-actions">
              <button type="button" className="secondary-button" onClick={safeCloseAdminLogin}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleAdminPasswordSubmit}>
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveAdminConfirm && (
        <div
          className={`admin-login-overlay ${closingLeaveAdminConfirm ? 'closing' : ''}`}
          onClick={safeCloseLeaveAdmin}
        >
          <div
            className={`admin-login-modal confirm-modal ${closingLeaveAdminConfirm ? 'closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Leave Admin?</h3>
            <p>Are you sure you wanna leave?</p>

            <div className="admin-login-actions">
              <button type="button" className="secondary-button" onClick={safeCloseLeaveAdmin}>
                Stay
              </button>
              <button type="button" className="primary-button" onClick={confirmLeaveAdmin}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="notification-stack" aria-live="polite">
        {visibleNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification ${notification.type}`}
            onPointerDown={(event) => handleNotificationPointerDown(notification.id, event)}
            onPointerMove={(event) => handleNotificationPointerMove(notification.id, event)}
            onPointerUp={() => handleNotificationPointerUp(notification.id)}
            onPointerLeave={() => handleNotificationPointerUp(notification.id)}
            style={{
              transform: `translate(${notification.offsetX}px, ${notification.offsetY}px)`,
            }}
          >
            <div className="notification-header">
              <strong>{notification.title}</strong>
              <button
                type="button"
                className="notification-close"
                onClick={() => removeNotification(notification.id)}
              >
                ×
              </button>
            </div>
            <p>{notification.message}</p>
            <div
              className="notification-progress"
              style={{ '--duration': `${notification.duration}ms` }}
            />
          </div>
        ))}
      </div>

      <footer className="site-footer">LastItem © 2026</footer>
    </main>
  );
}

export default App;
