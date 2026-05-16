import { ref } from "vue";
import { useI18n } from "vue-i18n";

// 导航项配置
export const navItems = [
  { icon: "collection", nameKey: "nav.collections", key: "collection" },
  { icon: "environment", nameKey: "nav.environments", key: "environment" },
  { icon: "workspace", nameKey: "nav.workspaces", key: "workspace" },
  { icon: "history", nameKey: "nav.history", key: "history" },
  { icon: "function", nameKey: "nav.features", key: "function" },
  { icon: "performance", nameKey: "nav.performance", key: "performance" },
  { icon: "toolbox", nameKey: "nav.toolbox", key: "toolbox" },
];

// 导出 composable 函数
export function useIconNavSetup(props, emit) {
  const { t } = useI18n();
  
  // 当前激活的导航索引
  const activeNav = ref(0);

  // 选择导航项
  const selectNav = (index) => {
    activeNav.value = index;
    emit("navChange", navItems[index].key);
  };

  // 设置激活导航（供外部调用）
  const setActiveNav = (index) => {
    activeNav.value = index;
  };

  // 获取当前导航项
  const currentNavItem = () => {
    return navItems[activeNav.value];
  };

  // 获取导航项名称（国际化）
  const getNavName = (item) => {
    return t(item.nameKey);
  };

  return {
    navItems,
    activeNav,
    selectNav,
    setActiveNav,
    currentNavItem,
    getNavName,
  };
}
