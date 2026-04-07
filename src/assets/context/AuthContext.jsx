import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            // Mock auth check using localStorage
            const storedUser = localStorage.getItem('mockUser');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (userData) => {
        // Mock login
        setUser(userData);
        localStorage.setItem('mockUser', JSON.stringify(userData));
    };

    const logout = async () => {
        // Mock logout
        setUser(null);
        localStorage.removeItem('mockUser');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);