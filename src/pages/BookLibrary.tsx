import React, { useEffect, useState } from 'react';
import { Book } from '../types';
import { db, auth } from '../lib/supabase';
import './BookLibrary.css';

interface BookLibraryProps {
  books: Book[];
  currentBook: Book | null;
  onSelectBook: (book: Book) => void;
  onAddBook: () => void;
  onLogOut: () => void;
  isAuthenticated: boolean;
}

export const BookLibrary: React.FC<BookLibraryProps> = ({
  books,
  currentBook,
  onSelectBook,
  onAddBook,
  onLogOut,
  isAuthenticated,
}) => {
  const [cloudBooks, setCloudBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await auth.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to get user:', err);
      }
    };

    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated]);

  // Load books from cloud
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const loadCloudBooks = async () => {
      setLoading(true);
      try {
        const loadedBooks = await db.books.getAll(user.id);
        setCloudBooks(loadedBooks);
      } catch (err) {
        console.error('Failed to load books:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCloudBooks();
  }, [isAuthenticated, user]);

  // Sync local books to cloud
  const handleSyncBooks = async () => {
    if (!isAuthenticated || !user) return;

    setIsSyncing(true);
    try {
      for (const book of books) {
        if (book.userId === 'local') {
          // Save to cloud
          const bookToSave = {
            ...book,
            userId: user.id,
          };
          await db.books.create(bookToSave);
        }
      }
      // Reload cloud books
      const loadedBooks = await db.books.getAll(user.id);
      setCloudBooks(loadedBooks);
    } catch (err) {
      console.error('Failed to sync books:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete book from cloud
  const handleDeleteCloudBook = async (bookId: string) => {
    if (!confirm('Delete this book from cloud?')) return;

    try {
      await db.books.delete(bookId);
      setCloudBooks(cloudBooks.filter((b) => b.id !== bookId));
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  return (
    <div className="book-library">
      <div className="library-header">
        <div className="library-title">
          <h2>My Books</h2>
          {isAuthenticated && user && (
            <p className="user-info">Signed in as: {user.email}</p>
          )}
        </div>

        <div className="library-actions">
          {isAuthenticated && (
            <button
              onClick={handleSyncBooks}
              disabled={isSyncing || books.length === 0}
              className="btn-sync"
              title="Upload local books to cloud"
            >
              {isSyncing ? 'Syncing...' : '☁ Sync to Cloud'}
            </button>
          )}
          <button onClick={onAddBook} className="btn-add">
            + Add Book
          </button>
          {isAuthenticated && (
            <button onClick={onLogOut} className="btn-logout">
              Sign Out
            </button>
          )}
        </div>
      </div>

      <div className="library-content">
        {/* Local Books */}
        <section className="books-section">
          <h3>📱 Local Books</h3>
          {books.length === 0 ? (
            <p className="empty-state">No local books. Upload one to get started!</p>
          ) : (
            <div className="books-grid">
              {books.map((book) => (
                <div
                  key={book.id}
                  className={`book-card ${currentBook?.id === book.id ? 'active' : ''}`}
                  onClick={() => onSelectBook(book)}
                >
                  <div className="book-cover">
                    <span className="book-icon">📖</span>
                  </div>
                  <div className="book-info">
                    <h4>{book.title}</h4>
                    <p className="book-author">{book.author}</p>
                    <p className="book-meta">
                      {book.totalWords} words • {book.format.toUpperCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cloud Books */}
        {isAuthenticated && (
          <section className="books-section">
            <h3>☁ Cloud Books</h3>
            {loading ? (
              <p className="loading">Loading cloud books...</p>
            ) : cloudBooks.length === 0 ? (
              <p className="empty-state">No cloud books yet. Sync local books to save them!</p>
            ) : (
              <div className="books-grid">
                {cloudBooks.map((book) => (
                  <div
                    key={book.id}
                    className={`book-card ${currentBook?.id === book.id ? 'active' : ''}`}
                    onClick={() => onSelectBook(book)}
                  >
                    <div className="book-cover">
                      <span className="book-icon">☁</span>
                    </div>
                    <div className="book-info">
                      <h4>{book.title}</h4>
                      <p className="book-author">{book.author}</p>
                      <p className="book-meta">
                        {book.totalWords} words • {book.format.toUpperCase()}
                      </p>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCloudBook(book.id);
                      }}
                      aria-label="Delete book"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default BookLibrary;
