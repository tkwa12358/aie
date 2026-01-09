import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="font-semibold">组件渲染出错</h3>
                    </div>
                    <p className="text-sm opacity-90">{this.state.error?.message || '未知错误'}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="mt-2"
                    >
                        重试
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
