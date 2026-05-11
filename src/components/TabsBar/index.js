// TabsBar composable
export function useTabsBarSetup(props, emit) {
  const selectTab = (index) => {
    emit('update:activeTab', index)
  }

  const closeTab = (index, event) => {
    event.stopPropagation()
    emit('closeTab', index)
  }

  return {
    selectTab,
    closeTab
  }
}