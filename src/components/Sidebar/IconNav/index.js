import { ref } from "vue";

// 导航项配置
export const navItems = [
  { icon: "collection", name: "集合", key: "collection" },
  { icon: "environment", name: "环境", key: "environment" },
  { icon: "workspace", name: "工作区", key: "workspace" },
  { icon: "function", name: "功能", key: "function" },
  { icon: "performance", name: "性能", key: "performance" },
  { icon: "toolbox", name: "工具箱", key: "toolbox" },
];

// 导出 composable 函数
export function useIconNavSetup(props, emit) {
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

  return {
    navItems,
    activeNav,
    selectNav,
    setActiveNav,
    currentNavItem,
  };
}
