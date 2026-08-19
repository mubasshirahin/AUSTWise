import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-loading" style={{ minHeight: '55vh', alignItems: 'center', gap: 12 }}>
          <span>Something went wrong while loading this page.</span>
          <button type="button" className="am-login-btn" onClick={this.handleReset}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}