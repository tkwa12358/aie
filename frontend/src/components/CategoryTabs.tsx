import React, { useState, useEffect } from 'react';
import { categoriesApi, VideoCategory } from '@/lib/api-client';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface CategoryTabsProps {
    selectedCategory: string | null;
    onSelectCategory: (categoryId: string | null) => void;
    onLocalLearningClick: () => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
    selectedCategory,
    onSelectCategory,
    onLocalLearningClick,
}) => {
    const [categories, setCategories] = useState<VideoCategory[]>([]);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const data = await categoriesApi.getCategories();
            setCategories(data);
        } catch (error) {
            console.error('获取分类失败:', error);
        }
    };

    // 获取当前选中分类的名称
    const getSelectedLabel = () => {
        if (selectedCategory === null) return '全部分类';
        const category = categories.find(c => c.id === selectedCategory);
        return category?.name || '全部分类';
    };

    return (
        <div className="flex items-center gap-3 mb-6">
            {/* 分类下拉框 */}
            <Select
                value={selectedCategory || 'all'}
                onValueChange={(value) => onSelectCategory(value === 'all' ? null : value)}
            >
                <SelectTrigger className="w-[160px] h-10 rounded-xl border-dashed border-primary/50 bg-primary/5 text-primary font-medium">
                    <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent className="glass rounded-xl border-white/20">
                    <SelectItem value="all" className="rounded-lg">
                        全部分类
                    </SelectItem>
                    {categories.map((category) => (
                        <SelectItem
                            key={category.id}
                            value={category.id}
                            className="rounded-lg"
                        >
                            {category.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* 本地学习按钮 */}
            <Button
                variant="outline"
                onClick={onLocalLearningClick}
                className="h-10 px-4 rounded-xl border-dashed border-primary/50 hover:border-primary bg-primary/5 text-primary hover:bg-primary/10 flex items-center gap-2"
            >
                <Upload className="h-4 w-4" />
                本地学习
            </Button>
        </div>
    );
};

export default CategoryTabs;
